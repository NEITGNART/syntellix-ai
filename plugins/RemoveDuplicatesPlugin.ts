import { CommandType, Disposable, ICommand, ICommandService, Inject, Injector, Plugin, UniverInstanceType } from '@univerjs/core';
import { ComponentManager, IMenuManagerService, MenuItemType, RibbonDataGroup } from '@univerjs/ui';
import React from 'react';

// Command ID
export const REMOVE_DUPLICATES_COMMAND_ID = 'syntellix.command.remove-duplicates';
const REMOVE_DUPLICATES_ICON = 'RemoveDuplicatesIcon';

// Custom Icon Component - Remove Duplicates icon (stacked layers with X)
const RemoveDuplicatesIconComponent = () => {
  return React.createElement('svg', {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '2',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }, [
    // Two stacked rectangles representing duplicates
    React.createElement('rect', { key: 'rect1', x: '3', y: '3', width: '14', height: '14', rx: '2' }),
    React.createElement('rect', { key: 'rect2', x: '7', y: '7', width: '14', height: '14', rx: '2' }),
    // X mark to indicate removal
    React.createElement('line', { key: 'line1', x1: '15', y1: '9', x2: '19', y2: '13' }),
    React.createElement('line', { key: 'line2', x1: '19', y1: '9', x2: '15', y2: '13' }),
  ]);
};

// Command to trigger remove duplicates modal
export const RemoveDuplicatesCommand: ICommand = {
  id: REMOVE_DUPLICATES_COMMAND_ID,
  type: CommandType.COMMAND,
  handler: async () => {
    // This will be handled by emitting an event that React can listen to
    window.dispatchEvent(new CustomEvent('syntellix-remove-duplicates'));
    return true;
  },
};

// Menu item factory
const removeDuplicatesMenuItemFactory = () => ({
  id: REMOVE_DUPLICATES_COMMAND_ID,
  type: MenuItemType.BUTTON,
  title: 'Remove Duplicates',
  tooltip: 'Remove duplicate rows based on selected columns',
  icon: REMOVE_DUPLICATES_ICON,
});

// Controller to register menu and command
class RemoveDuplicatesController extends Disposable {
  constructor(
    @Inject(Injector) private readonly _injector: Injector,
    @ICommandService private readonly _commandService: ICommandService,
    @IMenuManagerService private readonly _menuManagerService: IMenuManagerService,
    @Inject(ComponentManager) private readonly _componentManager: ComponentManager,
  ) {
    super();
    this._registerIcon();
    this._initCommands();
    this._initMenus();
  }

  private _registerIcon(): void {
    this.disposeWithMe(
      this._componentManager.register(REMOVE_DUPLICATES_ICON, RemoveDuplicatesIconComponent)
    );
  }

  private _initCommands(): void {
    this.disposeWithMe(
      this._commandService.registerCommand(RemoveDuplicatesCommand)
    );
  }

  private _initMenus(): void {
    this._menuManagerService.mergeMenu({
      [RibbonDataGroup.RULES]: {
        [REMOVE_DUPLICATES_COMMAND_ID]: {
          order: 99, // Place at the end of the RULES group
          menuItemFactory: removeDuplicatesMenuItemFactory,
        },
      },
    });
  }
}

// Plugin class
export class RemoveDuplicatesPlugin extends Plugin {
  static override pluginName = 'syntellix-remove-duplicates';
  static override type = UniverInstanceType.UNIVER_SHEET;

  constructor(
    _config: unknown,
    @Inject(Injector) protected override readonly _injector: Injector
  ) {
    super();
  }

  override onStarting(): void {
    this._injector.add([RemoveDuplicatesController]);
  }

  override onRendered(): void {
    this._injector.get(RemoveDuplicatesController);
  }
}
