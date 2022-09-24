import { ExtensionContext } from "vscode";
import { IPinner } from "./pick";

export class GlobalStateBackedPinner implements IPinner {
  private _pinnedSet: Set<string> | undefined;

  constructor(private readonly context: ExtensionContext) {}

  private get pinnedSet(): Set<string> {
    if (this._pinnedSet) return this._pinnedSet;

    const pinned = this.context.globalState.get<string[]>("pinned", []);
    this._pinnedSet = new Set(pinned);
    return this._pinnedSet;
  }

  isPinned(url: string): boolean {
    return this.pinnedSet.has(url);
  }

  pin(url: string): void {
    const pinned = this.context.globalState.get<string[]>("pinned", []).filter((pu) => pu !== url);
    pinned.push(url);
    this.save(pinned);
  }

  unpin(url: string): void {
    const pinned = this.context.globalState.get<string[]>("pinned", []).filter((pu) => pu !== url);
    this.save(pinned);
  }

  save(pinned: string[]) {
    this.context.globalState.update("pinned", pinned);
    this._pinnedSet = undefined;
  }
}
