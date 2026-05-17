import type { CardSkillTreeConfig } from '../unit-system/SkillTreeState.js';

export interface CardInstanceEntry {
  readonly instanceId: string;
  readonly cardId: string;
  readonly cardName?: string;
  readonly level?: number;
  readonly activeNodeCount?: number;
  readonly equippedPath?: string | null;
  readonly config?: CardSkillTreeConfig;
}

export interface DeckViewState {
  readonly cardIds: readonly string[];
  readonly instances?: readonly CardInstanceEntry[];
  readonly selectedInstanceId?: string | null;
  readonly sp?: number;
}

export type DeckViewAction =
  | 'close'
  | { readonly kind: 'select-instance'; readonly instanceId: string }
  | { readonly kind: 'activate-node'; readonly instanceId: string; readonly nodeId: string }
  | { readonly kind: 'equip-path'; readonly instanceId: string; readonly pathId: string };

export type DeckViewHandler = (action: DeckViewAction) => void;

export class DeckViewPanel {
  private state: DeckViewState | null = null;
  private handler: DeckViewHandler | null = null;

  setHandler(handler: DeckViewHandler): void {
    this.handler = handler;
  }

  refresh(state: DeckViewState): void {
    this.state = state;
  }

  getState(): DeckViewState | null {
    return this.state;
  }

  trigger(action: DeckViewAction): void {
    this.handler?.(action);
  }

  selectInstance(instanceId: string): void {
    this.handler?.({ kind: 'select-instance', instanceId });
  }

  activateNode(instanceId: string, nodeId: string): void {
    this.handler?.({ kind: 'activate-node', instanceId, nodeId });
  }

  equipPath(instanceId: string, pathId: string): void {
    this.handler?.({ kind: 'equip-path', instanceId, pathId });
  }
}
