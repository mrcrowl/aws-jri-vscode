import type {
  Disposable,
  Event,
  FileSystemWatcher,
  QuickInputButton,
  QuickPick,
  QuickPickItemButtonEvent,
  Uri,
} from 'vscode';
import { SelectResourceQuickPickItem, VariousQuickPickItem } from '../pick';
import { Resource } from '../resource';
import { IKeyValueStorage } from '../ui/interfaces';

export class FakeStorage implements IKeyValueStorage {
  private readonly storedValues = new Map<string, unknown>();

  clear() {
    this.storedValues.clear();
  }

  get<T>(key: string, defaultValue: T): T {
    return (this.storedValues.get(key) as T) ?? defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.storedValues.set(key, value);
  }
}

export class FakeFileSystemWatcher implements FileSystemWatcher {
  ignoreCreateEvents = false;
  ignoreChangeEvents = false;
  ignoreDeleteEvents = true;
  #onDidChangeListener: ((e: Uri) => any) | undefined;
  #onDidCreateListener: ((e: Uri) => any) | undefined;
  fireOnDidChange = (uri: Uri) => this.#onDidChangeListener?.(uri);
  fireOnDidCreate = (uri: Uri) => this.#onDidCreateListener?.(uri);
  dispose = () => {};

  onDidChange(listener: (e: Uri) => any, thisArgs?: any, disposables?: Disposable[]): Disposable {
    this.#onDidChangeListener = listener.bind(thisArgs);
    const disposable = { dispose: () => {} };
    disposables?.push(disposable);
    return disposable;
  }

  onDidCreate(listener: (e: Uri) => any, thisArgs?: any, disposables?: Disposable[]): Disposable {
    this.#onDidCreateListener = listener.bind(thisArgs);
    const disposable = { dispose: () => {} };
    disposables?.push(disposable);
    return disposable;
  }

  onDidDelete(): Disposable {
    throw new Error('onDidDelete is not implemented.');
  }
}

function makeFakeEvent<T = void>() {
  const listeners: ((e: T) => any)[] = [];
  const event: Event<T> = (listener: (e: T) => any, _: any, disposables?: Disposable[]) => {
    listeners.push(listener);
    const disposable: Disposable = {
      dispose: () => listeners.splice(listeners.indexOf(listener), 1),
    };
    disposables?.push(disposable);
    return disposable;
  };
  const trigger = (e: T) => {
    listeners.forEach(l => l(e));
  };
  return [event, trigger] as const;
}

export class FakeQuickPick implements QuickPick<VariousQuickPickItem> {
  // Props.
  activeItems: readonly VariousQuickPickItem[] = [];
  busy: boolean = false;
  buttons: readonly QuickInputButton[] = [];
  canSelectMany: boolean = false;
  enabled: boolean = true;
  ignoreFocusOut: boolean = false;
  keepScrollPosition?: boolean | undefined;
  matchOnDescription: boolean = false;
  matchOnDetail: boolean = false;
  placeholder: string | undefined;
  selectedItems: readonly VariousQuickPickItem[] = [];
  step: number | undefined;
  title: string | undefined;
  totalSteps: number | undefined;
  value: string = '';

  // Events.
  onDidAccept: Event<void>;
  onDidTriggerButton: Event<QuickInputButton>;
  onDidTriggerItemButton: Event<QuickPickItemButtonEvent<VariousQuickPickItem>>;
  onDidChangeActive: Event<readonly VariousQuickPickItem[]>;
  onDidChangeValue: Event<string>;
  onDidChangeSelection: Event<readonly VariousQuickPickItem[]>;
  onDidHide: Event<void>;
  fireDidAccept: () => void;
  fireDidTriggerButton: (e: QuickInputButton) => void;
  fireDidTriggerItemButton: (e: QuickPickItemButtonEvent<VariousQuickPickItem>) => void;
  fireDidChangeActive: (e: readonly VariousQuickPickItem[]) => void;
  fireDidChangeValue: (e: string) => void;
  fireDidChangeSelection: (e: readonly VariousQuickPickItem[]) => void;
  fireDidHide: (e: void) => void;

  constructor() {
    [this.onDidAccept, this.fireDidAccept] = makeFakeEvent();
    [this.onDidTriggerButton, this.fireDidTriggerButton] = makeFakeEvent();
    [this.onDidTriggerItemButton, this.fireDidTriggerItemButton] = makeFakeEvent();
    [this.onDidChangeActive, this.fireDidChangeActive] = makeFakeEvent();
    [this.onDidChangeValue, this.fireDidChangeValue] = makeFakeEvent();
    [this.onDidChangeSelection, this.fireDidChangeSelection] = makeFakeEvent();
    [this.onDidHide, this.fireDidHide] = makeFakeEvent();
  }

  #items: readonly VariousQuickPickItem[] = [];
  get items(): readonly VariousQuickPickItem[] {
    return [...this.#items];
  }

  set items(items: readonly VariousQuickPickItem[]) {
    this.#items = items;
    this.activeItems = [];
    this.selectedItems = [];
  }

  fakeTypeFilterText(text: string) {
    this.value = text;
    this.fireDidChangeValue(text);
  }

  fakeSelectResourceWithUrl(url: string) {
    this.fakeSelectItems(item => item.variant === 'resource:select' && item.url === url);
  }

  fakeSelectItems(filter: (item: VariousQuickPickItem) => boolean) {
    this.selectedItems = this.items.filter(filter);
    if (this.selectedItems.length === 0) {
      this.selectedItems = [this.items[0]];
    }
    this.fireDidAccept();
  }

  get itemResources(): readonly Resource[] {
    const resourceItems = this.items.filter(
      item => item.variant === 'resource:select',
    ) as SelectResourceQuickPickItem[];
    return resourceItems.map(item => item.resource);
  }

  get fakeNumRecentItems(): number {
    return this.items.findIndex(item => item.variant === 'separator');
  }

  hide = () => this.fireDidHide();
  show = () => {};
  dispose = () => {};
}
