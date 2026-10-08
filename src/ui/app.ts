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
  closeBox,
  currentNotes,
  currentPackage,
  flipBox,
  inspect,
  noteDefect,
  openBox,
  repair,
  rotateBox,
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
  type PurchasableTool,
} from '../game/shop';
import { animationProgress, type PackageAction } from './animation';
import { contentsFor } from './contents';
import { button, el } from './dom';
import { createSoundControls } from './soundControls';
import { money } from './money';
import { drawPackage } from './packageArt';
import { DEFECTS } from '../game/defects';
import { faceCount } from '../game/shapes';
import type { Handling, Package } from '../game/types';
import { sideOf, viewOf } from '../game/handling';
import { markerNoted, markersFor, type Marker } from './markers';

const rotateLabel = (pkg: Package, h: Handling): string => {
  const count = faceCount(pkg.kind, sideOf(h));
  return count > 1 ? `Rotate (${h.face + 1}/${count})` : 'Rotate';
};

const STAGE_W = 320;
const STAGE_H = 260;

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

  const soundControls = createSoundControls(audio, () => render());

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
      el('p', { text: 'Opening a box that does not need opening costs 2x its shipping fee.' }),
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

    const view = viewOf(s.handling);
    const canvas = el('canvas', { attrs: { width: String(STAGE_W), height: String(STAGE_H) } });
    animate(canvas, s);

    // Each marker is a real button over the drawing: click to take a note, Tab to reach it.
    // Largest first, so smaller, more specific markers come later in the DOM and sit on top, still clickable.
    const byAreaDescending = (a: Marker, b: Marker): number => b.rect.w * b.rect.h - a.rect.w * a.rect.h;
    const markerButtons = markersFor(pkg, s.handling, STAGE_W, STAGE_H)
      .sort(byAreaDescending)
      .map((m) => {
        const noted = markerNoted(pkg, s.handling, m);
        const b = button('', act((st) => noteDefect(st, m.defect, m.view)), false, noted ? 'marker noted' : 'marker');
        b.setAttribute('aria-label', `${noted ? 'Noted' : 'Take a note'}: ${DEFECTS[m.defect].label}`);
        b.style.left = `${(m.rect.x / STAGE_W) * 100}%`;
        b.style.top = `${(m.rect.y / STAGE_H) * 100}%`;
        b.style.width = `${(m.rect.w / STAGE_W) * 100}%`;
        b.style.height = `${(m.rect.h / STAGE_H) * 100}%`;
        return b;
      });
    const stage = el('div', { cls: 'stage' }, [canvas, ...markerButtons]);

    const label = el('div', { cls: 'label-card' }, [
      ...addressLines(pkg.address).map((line) => el('div', { text: line })),
      el('div', { text: `Declared weight: ${pkg.declaredWeightKg} kg` }),
    ]);
    const inside =
      view === 'inside'
        ? [el('p', { cls: 'inside', text: `Inside: ${contentsFor(pkg, s.handling.repaired).item.name}` })]
        : [];

    const noted = currentNotes(s);
    const notes = el('div', { cls: 'panel' }, [
      el('h3', { text: 'Notes' }),
      ...(noted.length > 0 ? [el('ul', {}, noted.map((c) => el('li', { text: c.text })))] : []),
      ...(noted.length <= 1
        ? [el('p', { cls: 'muted', text: 'Click a marker on the package to take a note.' })]
        : []),
    ]);

    const tools = INSPECTION_ITEMS.filter(
      (t): t is Exclude<PurchasableTool, 'rotate'> => t !== 'rotate' && s.inventory.tools.includes(t),
    );
    const ownsFlip = s.inventory.tools.includes('rotate');
    const faceUp = view === 'front';
    const inspectRow = el('div', { cls: 'row' }, [
      ...tools.map((t) => button(ITEM_NAMES[t], act((st) => inspect(st, t), t), !faceUp || s.handling.used.includes(t))),
      ...(ownsFlip
        ? [
            button(
              rotateLabel(pkg, s.handling),
              act(rotateBox),
              view === 'inside' || faceCount(pkg.kind, sideOf(s.handling)) <= 1,
            ),
            button(
              view === 'back' ? 'Flip box back' : 'Flip box',
              act(flipBox),
              view === 'inside' || (view === 'front' && faceCount(pkg.kind, 'down') === 0),
            ),
          ]
        : []),
      ...(tools.length === 0 && !ownsFlip ? [el('span', { cls: 'muted', text: 'No inspection tools yet.' })] : []),
    ]);

    const stocked = REPAIR_ITEMS.filter((t) => s.inventory.supplies[t] > 0);
    const repairRow = el('div', { cls: 'row' }, [
      button(view === 'inside' ? 'Close box' : 'Open box', act(view === 'inside' ? closeBox : openBox), view === 'back'),
      ...stocked.map((t) =>
        button(`${ITEM_NAMES[t]} (${s.inventory.supplies[t]})`, act((st) => repair(st, t), 'repair')),
      ),
    ]);

    const stampRow = el('div', { cls: 'row' }, [
      button('SHIP', act((st) => stamp(st, 'ship')), s.handling.opened, 'ship'),
      button('REJECT', act((st) => stamp(st, 'reject')), false, 'reject'),
      ...(s.handling.opened ? [el('span', { cls: 'muted', text: 'Close the box before shipping.' })] : []),
    ]);

    return el('div', {}, [
      hud,
      el('div', { cls: 'grid' }, [
        el('div', {}, [stage, label, ...inside]),
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
    const header = el('div', { cls: 'header' }, [el('h1', { text: 'PackInspect' }), soundControls()]);
    root.replaceChildren(header, screens[campaign.phase]());
  }

  render();
}
