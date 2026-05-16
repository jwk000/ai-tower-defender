export interface DeckViewState {
  readonly cardIds: readonly string[];
}

export type DeckViewAction = 'close';
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
}
