import type {
  Disposable,
  Event,
  FileSystemWatcher,
  InputBox,
  QuickInputButton,
  QuickPick,
  QuickPickItemButtonEvent,
  Uri,
} from 'vscode';
import { Resource } from '../model/resource';
import { IKeyValueStorage } from '../ui/interfaces';
import { SelectResourceQuickPickItem, VariousQuickPickItem } from '../ui/pick';

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

export class FakeInputBox implements InputBox {
  value: string = '';
  placeholder: string | undefined;
  password: boolean = false;
  buttons: readonly QuickInputButton[] = [];
  prompt: string | undefined;
  validationMessage: string | undefined;
  title: string | undefined;
  step: number | undefined;
  totalSteps: number | undefined;
  enabled: boolean = false;
  busy: boolean = false;
  ignoreFocusOut: boolean = false;

  show(): void {}
  hide(): void {}
  dispose = () => {};

  onDidHide: Event<void>;
  onDidChangeValue: Event<string>;
  onDidAccept: Event<void>;
  onDidTriggerButton: Event<QuickInputButton>;
  fireDidAccept: () => void;
  fireDidTriggerButton: (e: QuickInputButton) => void;
  private fireDidChangeValue: (e: string) => void;
  fireDidHide: (e: void) => void;

  typeText(text: string) {
    this.value = text;
    this.fireDidChangeValue(text);
  }

  constructor() {
    [this.onDidAccept, this.fireDidAccept] = makeFakeEvent();
    [this.onDidTriggerButton, this.fireDidTriggerButton] = makeFakeEvent();
    [this.onDidChangeValue, this.fireDidChangeValue] = makeFakeEvent();
    [this.onDidHide, this.fireDidHide] = makeFakeEvent();
  }
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

  typeFilterText(text: string) {
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
