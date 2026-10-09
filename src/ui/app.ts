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
  discardItem,
  noteDefect,
  noteLeak,
  openBox,
  readLabel,
  stamp,
  type ActionResult,
  type ShiftState,
} from '../game/shift';
import { ITEM_NAMES, PRICES, isInspectionItem, unlockedItems } from '../game/shop';
import { animationProgress, type PackageAction } from './animation';
import { button, el } from './dom';
import { createSoundControls } from './soundControls';
import { money } from './money';
import { addressGuide, restrictionGuide, shapeGuide, tabsFor, TAB_LABELS, type TabId } from './reference';
import { drawPackage } from './packageArt';
import { DEFECTS } from '../game/defects';
import type { DefectId, Handling, Package } from '../game/types';
import { viewOf } from '../game/handling';
import { itemsIn, legitItemIds } from '../game/contents';
import { itemMarkersFor, labelMarkersFor, markerNoted, markersFor } from './markers';
import type { Rect } from './geometry';
import {
  animationFor,
  canTarget,
  isSupply,
  leakTarget,
  ownedTools,
  putDownAfter,
  toggleTool,
  toolLabel,
  toolName,
  useTool,
  type ToolId,
  type UseTarget,
} from './toolActions';
import { drawTool } from './toolArt';

// What the contents label says is inside: nothing while it is missing, else what it was printed for.
const labelText = (pkg: Package, h: Handling): string => {
  if (pkg.defects.includes('missing_label') && !h.repaired.includes('missing_label')) return '(missing)';
  const ids = h.labelItems ?? legitItemIds(pkg);
  const names = ids.map((id) => pkg.contents.find((i) => i.id === id)?.name).filter(Boolean);
  return names.length > 0 ? names.join(', ') : '(none)';
};

const STAGE_W = 320;
const STAGE_H = 260;

const TOOL_PX = 48;

// The one Esc handler, so mounting again does not stack listeners.
let escHandler: ((e: KeyboardEvent) => void) | null = null;

const fineText = (fines: number): string => money(fines > 0 ? -fines : 0);

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by browser privacy settings
  }
}

// Rows repeat the same button text, so each needs a name that says which item it acts on.
function labelled(b: HTMLButtonElement, label: string): HTMLButtonElement {
  b.setAttribute('aria-label', label);
  return b;
}

const listOrNone = (items: string[]): HTMLElement =>
  items.length > 0
    ? el('ul', {}, items.map((text) => el('li', { text })))
    : el('p', { cls: 'muted', text: 'None today.' });

// The body of the active reference tab under the rule card.
function referenceBody(tab: TabId, s: ShiftState): HTMLElement[] {
  if (tab === 'shapes') {
    return shapeGuide(s.day).flatMap((shape) => [
      el('h4', { text: shape.name }),
      el('div', { cls: 'muted', text: shape.kinds }),
      el('p', { text: shape.description }),
    ]);
  }
  if (tab === 'addresses') {
    const guide = addressGuide(s.card);
    const rules = el(
      'ul',
      {},
      guide.rules.map((r) =>
        el('li', { text: `${r.text} (${r.rejected ? 'rejected' : 'tolerated'} today)` }),
      ),
    );
    if (guide.cityZips.length === 0) return [rules];
    const table = el('table', { cls: 'zips' }, [
      el('tr', {}, [el('th', { text: 'City' }), el('th', { text: 'ZIP' })]),
      ...guide.cityZips.map((c) => el('tr', {}, [el('td', { text: c.city }), el('td', { text: c.zip })])),
    ]);
    return [rules, table];
  }
  if (tab === 'restrictions') {
    const guide = restrictionGuide(s.card);
    return [
      el('h4', { text: 'Restricted destinations' }),
      listOrNone(guide.destinations),
      el('h4', { text: 'Restricted items' }),
      listOrNone(guide.items),
      ...(guide.items.length > 0
        ? [el('p', { text: 'A restricted item can be thrown away: open the box, then use Throw away.' })]
        : []),
    ];
  }
  return [
    el('h3', { text: s.card.title }),
    el('ul', {}, s.card.lines.map((line) => el('li', { text: line }))),
    el('p', { text: 'Opening a box that does not need opening costs 2x its shipping fee.' }),
  ];
}

export function mount(root: HTMLElement, seed: number): void {
  let campaign = startCampaign(seed);
  let message = '';
  let tab: TabId = 'rules';
  const audio = createAudioEngine(safeStorage());
  // Browsers only allow audio after a user gesture; capture so it is ready before the click's own sound.
  root.addEventListener('click', () => audio.resume(), true);
  // The most recent interaction, so the canvas can animate it (cleared when it finishes).
  let lastAction: { action: PackageAction; startedAt: number; fresh: DefectId[] } | null = null;
  // The tool in the player's hand; the next click on the package, a marker or an item uses it.
  let selectedTool: ToolId | null = null;
  // Where the last shift render was, so moving to a new package or opening/closing puts the tool down.
  let lastSeen: { index: number; opened: boolean } | null = null;

  if (escHandler) document.removeEventListener('keydown', escHandler);
  escHandler = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !selectedTool || campaign.phase !== 'shift') return;
    selectedTool = null;
    render();
  };
  document.addEventListener('keydown', escHandler);

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
      // A repair only animates when it added a patch.
      const fresh = result.state.handling.repaired.slice(campaign.shift!.handling.repaired.length);
      lastAction =
        action && result.state !== campaign.shift && (action !== 'repair' || fresh.length > 0)
          ? { action, startedAt: performance.now(), fresh }
          : null;
      update({ ...campaign, shift: result.state }, result.message);
    };

  // A click on something on the package: uses the tool in hand there, else does the plain click.
  const use =
    (target: UseTarget, plain: () => void = () => undefined) =>
    (): void => {
      const tool = selectedTool;
      if (!tool) return plain();
      act((st) => {
        const result = useTool(st, tool, target);
        if (putDownAfter(tool, target, result.state !== st)) selectedTool = null;
        return result;
      }, animationFor(tool, target))();
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
      drawPackage(ctx, pkg, s.handling, { action: current.action, progress, fresh: current.fresh });
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

    const tabs = tabsFor(s.card);
    if (!tabs.includes(tab)) tab = 'rules';
    const tabButtons = el(
      'div',
      { cls: 'tabs' },
      tabs.map((id) => {
        const b = button(
          TAB_LABELS[id],
          () => {
            tab = id;
            render();
          },
          false,
          id === tab ? 'tab active' : 'tab',
        );
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(id === tab));
        return b;
      }),
    );
    tabButtons.setAttribute('role', 'tablist');
    const card = el('div', { cls: 'panel' }, [tabButtons, ...referenceBody(tab, s)]);

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
    const owned = ownedTools(s.inventory);
    const moved = lastSeen !== null && (lastSeen.index !== s.index || lastSeen.opened !== s.handling.opened);
    // A supply that ran out is no longer owned, so it drops out of the hand too.
    if (moved || (selectedTool && !owned.includes(selectedTool))) selectedTool = null;
    lastSeen = { index: s.index, opened: s.handling.opened };
    const tool = selectedTool;
    const aimed = (target: UseTarget): boolean => tool !== null && canTarget(tool, target, s.handling.opened);
    // While a tool is in hand a marker says what it will be used on, else what a plain click does.
    const markerLabel = (what: string, plain: string): string => (tool ? `Use the ${toolName(tool)} on ${what}` : plain);
    const markerCls = (base: string, target: UseTarget): string => (aimed(target) ? `${base} target` : base);

    const canvas = el('canvas', { attrs: { width: String(STAGE_W), height: String(STAGE_H) } });
    animate(canvas, s);
    canvas.addEventListener('click', use({ kind: 'package' }));

    // Each marker is a real button over the drawing: click to take a note, Tab to reach it.
    // Largest first, so smaller, more specific markers come later in the DOM and sit on top, still clickable.
    const placed = (b: HTMLButtonElement, rect: Rect): HTMLButtonElement => {
      b.style.left = `${(rect.x / STAGE_W) * 100}%`;
      b.style.top = `${(rect.y / STAGE_H) * 100}%`;
      b.style.width = `${(rect.w / STAGE_W) * 100}%`;
      b.style.height = `${(rect.h / STAGE_H) * 100}%`;
      return b;
    };
    const defectMarkers = markersFor(pkg, s.handling, STAGE_W, STAGE_H).map((m) => {
      const noted = markerNoted(pkg, s.handling, m);
      const target: UseTarget = { kind: 'defect', id: m.defect };
      const b = button('', use(target, act((st) => noteDefect(st, m.defect, m.view))), false, markerCls(noted ? 'marker noted' : 'marker', target));
      b.setAttribute('aria-label', markerLabel(`the ${DEFECTS[m.defect].label.toLowerCase()}`, `${noted ? 'Noted' : 'Take a note'}: ${DEFECTS[m.defect].label}`));
      return { rect: m.rect, button: placed(b, m.rect) };
    });
    const leakMarkers = itemMarkersFor(pkg, s.handling, STAGE_W, STAGE_H).map((m) => {
      const noted = s.handling.notes.includes(`leak:${m.itemId}`);
      const name = pkg.contents.find((i) => i.id === m.itemId)?.name ?? 'item';
      // Tools that do nothing to an item act on the package the leak is in.
      const target = tool ? leakTarget(tool, m.itemId) : { kind: 'item' as const, itemId: m.itemId };
      const b = button('', use(target, act((st) => noteLeak(st, m.itemId))), false, markerCls(noted ? 'marker noted' : 'marker', target));
      b.setAttribute('aria-label', markerLabel(`the leaking ${name}`, `${noted ? 'Noted' : 'Take a note'}: leaking ${name}`));
      return { rect: m.rect, button: placed(b, m.rect) };
    });
    const labelMarkers = labelMarkersFor(pkg, s.handling, STAGE_W, STAGE_H).map((m) => {
      const read = m.label === 'shipping' ? s.handling.addressRead : s.handling.contentsRead;
      const target: UseTarget = { kind: m.label === 'shipping' ? 'shippingLabel' : 'contentsLabel' };
      const b = button('', use(target, act((st) => readLabel(st, m.label))), false, markerCls(read ? 'marker label read' : 'marker label', target));
      b.setAttribute('aria-label', markerLabel(`the ${m.label} label`, `Read the ${m.label} label`));
      return { rect: m.rect, button: placed(b, m.rect) };
    });
    const markerButtons = [...defectMarkers, ...leakMarkers, ...labelMarkers]
      .sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h)
      .map((m) => m.button);
    const stage = el('div', { cls: aimed({ kind: 'package' }) ? 'stage aim' : 'stage' }, [canvas, ...markerButtons]);
    if (tool) stage.setAttribute('data-tool', '1');

    const hint = (text: string) => el('div', { cls: 'muted', text });
    const shippingPanel = s.handling.addressRead
      ? el('div', { cls: 'label-card' }, [
          ...addressLines(pkg.address).map((line) => el('div', { text: line })),
          el('div', { text: `Declared weight: ${pkg.declaredWeightKg} kg` }),
        ])
      : hint('Shipping label: find it on the package and click it.');
    const contentsPanel = s.handling.contentsRead
      ? el('div', { cls: 'label-card' }, [el('div', { text: `Contents: ${labelText(pkg, s.handling)}` })])
      : hint('Contents label: find it on the package and click it.');
    const label = el('div', { cls: 'labels' }, [shippingPanel, contentsPanel]);
    const inside =
      view === 'inside'
        ? [
            el('ul', { cls: 'contents' }, itemsIn(pkg, s.handling).map((item) => {
              const weighed = s.handling.notes.includes(`item:${item.id}`);
              const text = `${item.name}: ${weighed ? `${item.weightKg} kg` : '?'}`;
              const target: UseTarget = { kind: 'item', itemId: item.id };
              // The name is only clickable while a tool is in hand: that is what it is clicked with.
              const name = tool
                ? labelled(button(text, use(target), false, markerCls('item', target)), `Use the ${toolName(tool)} on the ${item.name}`)
                : el('span', { text });
              return el('li', {}, [
                name,
                labelled(button('Throw away', act((st) => discardItem(st, item.id))), `Throw away the ${item.name}`),
              ]);
            })),
          ]
        : [];

    const noted = currentNotes(s);
    const notes = el('div', { cls: 'panel' }, [
      el('h3', { text: 'Notes' }),
      ...(noted.length > 0 ? [el('ul', {}, noted.map((c) => el('li', { text: c.text })))] : []),
      ...(noted.length <= 1
        ? [el('p', { cls: 'muted', text: 'Click a marker on the package to take a note.' })]
        : []),
    ]);

    // Each tool is drawn as itself; click to pick it up (gold border), click again or press Esc to put it down.
    const toolButton = (t: ToolId): HTMLButtonElement => {
      const picked = t === tool;
      const b = button('', () => {
        selectedTool = toggleTool(selectedTool, t);
        render();
      }, false, picked ? 'tool selected' : 'tool');
      b.title = toolName(t);
      b.setAttribute('aria-label', toolLabel(t, s.inventory));
      b.setAttribute('aria-pressed', String(picked));
      const art = el('canvas', { attrs: { width: String(TOOL_PX), height: String(TOOL_PX) } });
      const ctx = art.getContext('2d');
      if (ctx) drawTool(ctx, t, TOOL_PX);
      b.append(art);
      if (isSupply(t)) b.append(el('span', { cls: 'count', text: String(s.inventory.supplies[t]) }));
      return b;
    };
    const tray = el(
      'div',
      { cls: 'tray' },
      owned.length > 0 ? owned.map(toolButton) : [el('span', { cls: 'muted', text: 'No tools yet.' })],
    );

    const boxRow = el('div', { cls: 'row' }, [
      button(view === 'inside' ? 'Close box' : 'Open box', act(view === 'inside' ? closeBox : openBox), view === 'back' || (view !== 'inside' && s.handling.flipPos !== 0)),
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
        el('div', { cls: 'side' }, [
          card,
          notes,
          el('div', { cls: 'panel actions' }, [
            el('h3', { text: 'Tools' }),
            tray,
            el('h3', { text: 'Box' }),
            boxRow,
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
    // Leaving the shift (settling up, the shop) puts the tool down.
    if (campaign.phase !== 'shift') {
      selectedTool = null;
      lastSeen = null;
    }
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
