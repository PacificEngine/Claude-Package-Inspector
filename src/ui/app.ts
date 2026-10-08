import { createAudioEngine } from '../audio/engine';
import { soundsFor } from '../audio/events';
import { addressLines } from '../game/address';
import { bossNote } from '../game/boss';
import {
  buy,
  endDay,
  nextDay,
  startCampaign,
  toShop,
  type Campaign,
} from '../game/campaign';
import {
  MAX_STRIKES,
  currentClues,
  currentPackage,
  inspect,
  openBox,
  repair,
  stamp,
  type ActionResult,
  type ShiftState,
} from '../game/shift';
import {
  INSPECTION_ITEMS,
  ITEM_NAMES,
  PRICES,
  REPAIR_ITEMS,
  isInspectionItem,
  unlockedItems,
} from '../game/shop';
import { animationProgress, type PackageAction } from './animation';
import { contentsFor, describeContents } from './contents';
import { button, el } from './dom';
import { money } from './money';
import { drawPackage } from './packageArt';

const fineText = (fines: number): string => money(fines > 0 ? -fines : 0);

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by browser privacy settings
  }
}

export function mount(root: HTMLElement, seed: number): void {
  let campaign = startCampaign(seed);
  let message = '';
  const audio = createAudioEngine(safeStorage());
  // Browsers only allow audio after a user gesture; capture so it is ready before the click's own sound.
  root.addEventListener('click', () => audio.resume(), true);
  // The most recent interaction, so the canvas can animate it (cleared when it finishes).
  let lastAction: { action: PackageAction; startedAt: number } | null = null;

  const update = (next: Campaign, msg = ''): void => {
    for (const event of soundsFor(campaign, next)) audio.play(event);
    audio.setDay(next.day);
    campaign = next;
    message = msg;
    render();
  };

  const act =
    (fn: (s: ShiftState) => ActionResult, action?: PackageAction) =>
    (): void => {
      const result = fn(campaign.shift!);
      // Only animate when the action did something; a refused action just shows its message.
      lastAction =
        action && result.state !== campaign.shift ? { action, startedAt: performance.now() } : null;
      update({ ...campaign, shift: result.state }, result.message);
    };

  function animate(canvas: HTMLCanvasElement, s: ShiftState): void {
    const ctx = canvas.getContext('2d');
    const pkg = currentPackage(s);
    if (!ctx || !pkg) return;
    const current = lastAction;
    if (!current) {
      drawPackage(ctx, pkg, s.handling);
      return;
    }
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = (now: number): void => {
      const progress = animationProgress(current.action, now - current.startedAt, reduced);
      drawPackage(ctx, pkg, s.handling, { action: current.action, progress });
      if (progress < 1 && canvas.isConnected) requestAnimationFrame(frame);
      else if (lastAction === current) lastAction = null;
    };
    frame(performance.now());
  }

  function shiftScreen(): HTMLElement {
    const s = campaign.shift!;
    const pkg = currentPackage(s);

    const hud = el('div', { cls: 'hud' }, [
      el('span', { text: `Day ${s.day}` }),
      el('span', { text: `Package ${Math.min(s.index + 1, s.queue.length)}/${s.queue.length}` }),
      el('span', { text: `Strikes ${s.strikes}/${MAX_STRIKES}` }),
      el('span', { text: `Earned today ${money(s.earned)}` }),
      el('span', { text: `Fines ${fineText(s.fines)}` }),
      el('span', { text: `Bank ${money(campaign.bank)}` }),
    ]);

    const card = el('div', { cls: 'panel' }, [
      el('h3', { text: s.card.title }),
      el('ul', {}, s.card.lines.map((line) => el('li', { text: line }))),
      el('p', { text: 'Opening a box that needs no repair costs 2x its shipping fee.' }),
    ]);

    if (!pkg) {
      return el('div', {}, [
        hud,
        card,
        el('div', { cls: 'panel' }, [
          el('h2', { text: s.strikes >= MAX_STRIKES ? 'Three strikes. Shift over.' : 'Shift complete.' }),
          el('p', { text: message, cls: 'message' }),
          button('Settle up', () => update(endDay(campaign))),
        ]),
      ]);
    }

    const canvas = el('canvas', { attrs: { width: '320', height: '260' } });
    animate(canvas, s);

    const label = el('div', { cls: 'label-card' }, [
      ...addressLines(pkg.address).map((line) => el('div', { text: line })),
      el('div', { text: `Declared weight: ${pkg.declaredWeightKg} kg` }),
    ]);
    const inside = s.handling.opened
      ? [el('p', { cls: 'inside', text: `Inside: ${describeContents(contentsFor(pkg))}` })]
      : [];

    const notes = el('div', { cls: 'panel' }, [
      el('h3', { text: 'Notes' }),
      el('ul', {}, currentClues(s).map((c) => el('li', { text: c.text }))),
    ]);

    const owned = INSPECTION_ITEMS.filter((t) => s.inventory.tools.includes(t));
    const inspectRow = el('div', { cls: 'row' }, [
      ...owned.map((t) => button(ITEM_NAMES[t], act((st) => inspect(st, t), t), s.handling.used.includes(t))),
      ...(owned.length === 0 ? [el('span', { cls: 'muted', text: 'No inspection tools yet.' })] : []),
    ]);

    const stocked = REPAIR_ITEMS.filter((t) => s.inventory.supplies[t] > 0);
    const repairRow = el('div', { cls: 'row' }, [
      button('Open box', act(openBox, 'open'), s.handling.opened),
      ...stocked.map((t) =>
        button(`${ITEM_NAMES[t]} (${s.inventory.supplies[t]})`, act((st) => repair(st, t), 'repair')),
      ),
    ]);

    const stampRow = el('div', { cls: 'row' }, [
      button('SHIP', act((st) => stamp(st, 'ship')), false, 'ship'),
      button('REJECT', act((st) => stamp(st, 'reject')), false, 'reject'),
    ]);

    return el('div', {}, [
      hud,
      el('div', { cls: 'grid' }, [
        el('div', {}, [canvas, label, ...inside]),
        el('div', {}, [
          card,
          notes,
          el('div', { cls: 'panel' }, [
            el('h3', { text: 'Inspect' }),
            inspectRow,
            el('h3', { text: 'Repair' }),
            repairRow,
            el('h3', { text: 'Decide' }),
            stampRow,
            el('p', { cls: 'message', text: message }),
          ]),
        ]),
      ]),
    ]);
  }

  function dayEndScreen(): HTMLElement {
    const sum = campaign.summary!;
    const accuracy =
      sum.stamped === 0
        ? 'n/a'
        : `${Math.round((sum.correct / sum.stamped) * 100)}% (${sum.correct}/${sum.stamped})`;
    const accuracyPercent = sum.stamped === 0 ? 100 : (sum.correct / sum.stamped) * 100;
    return el('div', { cls: 'panel' }, [
      el('h2', { text: `Day ${sum.day} complete${sum.failed ? ' (cut short by strikes)' : ''}` }),
      el('ul', {}, [
        el('li', { text: `Shipped ${sum.shipped}, rejected ${sum.rejected}` }),
        el('li', { text: `Strikes: ${sum.strikes}` }),
        el('li', { text: `Accuracy: ${accuracy}` }),
        el('li', { text: `Earned: ${money(sum.earned)}` }),
        el('li', { text: `Fines: ${fineText(sum.fines)}` }),
        el('li', { text: `Payout: ${money(sum.payout)}` }),
        el('li', { text: `Bank: ${money(sum.bankAfter)}` }),
      ]),
      el('p', { cls: 'boss', text: `Boss: ${bossNote(sum.day, accuracyPercent, sum.failed)}` }),
      button('Continue', () => update(toShop(campaign))),
    ]);
  }

  function shopScreen(): HTMLElement {
    const rows = unlockedItems(campaign.day).map((item) => {
      const price = money(PRICES[item]);
      if (isInspectionItem(item)) {
        const owned = campaign.inventory.tools.includes(item);
        return el('div', { cls: 'row' }, [
          el('span', { text: `${ITEM_NAMES[item]} (one-time, ${price})` }),
          button(owned ? 'Owned' : 'Buy', () => {
            const r = buy(campaign, item);
            update(r.campaign, r.message);
          }, owned),
        ]);
      }
      const have = campaign.inventory.supplies[item];
      return el('div', { cls: 'row' }, [
        el('span', { text: `${ITEM_NAMES[item]} (${price} each, you have ${have})` }),
        ...[1, 5].map((qty) =>
          button(`Buy ${qty}`, () => {
            const r = buy(campaign, item, qty);
            update(r.campaign, r.message);
          }),
        ),
      ]);
    });

    return el('div', { cls: 'panel' }, [
      el('h2', { text: 'Supply Shop' }),
      el('p', { text: `Bank: ${money(campaign.bank)}` }),
      ...rows,
      el('p', { cls: 'message', text: message }),
      button(`Start day ${campaign.day + 1}`, () => update(nextDay(campaign))),
    ]);
  }

  function finishedScreen(): HTMLElement {
    return el('div', { cls: 'panel' }, [
      el('h2', { text: 'Campaign complete!' }),
      el('p', { text: `Final bank: ${money(campaign.bank)}` }),
      button('Play again', () => update(startCampaign(Math.floor(Math.random() * 100000)))),
    ]);
  }

  function render(): void {
    const screens = {
      shift: shiftScreen,
      dayEnd: dayEndScreen,
      shop: shopScreen,
      finished: finishedScreen,
    };
    const muteButton = button(`Sound: ${audio.isMuted() ? 'off' : 'on'}`, () => {
      audio.setMuted(!audio.isMuted());
      render();
    });
    const header = el('div', { cls: 'header' }, [el('h1', { text: 'PackInspect' }), muteButton]);
    root.replaceChildren(header, screens[campaign.phase]());
  }

  render();
}
