export interface CardInstanceEntry {
  readonly instanceId: string;
  readonly cardId: string;
  readonly cardName?: string;
  readonly level?: number;
  readonly canUpgrade?: boolean;
  readonly canDelete?: boolean;
  readonly nextUpgradeCostGold?: number | null;
  readonly upgradeLabel?: string;
  readonly deleteLabel?: string;
}

export interface DeckViewConfirmationState {
  readonly kind: 'upgrade' | 'delete';
  readonly instanceId: string;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
}

export interface DeckViewState {
  readonly cardIds: readonly string[];
  readonly instances?: readonly CardInstanceEntry[];
  readonly selectedInstanceId?: string | null;
  readonly gold?: number;
  readonly message?: string;
  readonly confirmation?: DeckViewConfirmationState | null;
  readonly removedCount?: number;
  readonly nextDeleteCostGold?: number | null;
}

export type DeckViewAction =
  | 'close'
  | { readonly kind: 'select-instance'; readonly instanceId: string }
  | { readonly kind: 'request-upgrade'; readonly instanceId: string }
  | { readonly kind: 'request-delete'; readonly instanceId: string }
  | { readonly kind: 'confirm-upgrade'; readonly instanceId: string }
  | { readonly kind: 'confirm-delete'; readonly instanceId: string }
  | { readonly kind: 'cancel-confirmation' };

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

  requestUpgrade(instanceId: string): void {
    this.handler?.({ kind: 'request-upgrade', instanceId });
  }

  requestDelete(instanceId: string): void {
    this.handler?.({ kind: 'request-delete', instanceId });
  }

  confirmUpgrade(instanceId: string): void {
    this.handler?.({ kind: 'confirm-upgrade', instanceId });
  }

  confirmDelete(instanceId: string): void {
    this.handler?.({ kind: 'confirm-delete', instanceId });
  }

  cancelConfirmation(): void {
    this.handler?.({ kind: 'cancel-confirmation' });
  }
}
