import {Component, Inject, OnInit, OnDestroy} from '@angular/core';

import {TransitRoutersPageService} from "./transit-routers-page.service";
import {DataTableFilterService} from "../../features/data-table/data-table-filter.service";
import {ListPageComponent} from "../../shared/list-page-component.class";
import {TabNameService} from "../../services/tab-name.service";

import {MatDialog} from "@angular/material/dialog";
import {ZacWrapperServiceClass, ZAC_WRAPPER_SERVICE} from "../../features/wrappers/zac-wrapper-service.class";
import {ConsoleEventsService} from "../../services/console-events.service";
import {ExtensionService, SHAREDZ_EXTENSION} from "../../features/extendable/extensions-noop.service";

@Component({
  selector: 'lib-edge-routers',
  templateUrl: './transit-routers-page.component.html',
  styleUrls: ['./transit-routers-page.component.scss']
})
export class TransitRoutersPageComponent extends ListPageComponent implements OnInit, OnDestroy {

  title = 'Transit Routers'
  tabs: { url: string, label: string }[] ;
  isLoading = false;
  edgeRouterRoleAttributes: any[] = [];
  formDataChanged = false;

  constructor(
      public override svc: TransitRoutersPageService,
      filterService: DataTableFilterService,
      dialogForm: MatDialog,
      private tabNames: TabNameService,
      consoleEvents: ConsoleEventsService,
      @Inject(ZAC_WRAPPER_SERVICE)private zacWrapperService: ZacWrapperServiceClass,
      @Inject(SHAREDZ_EXTENSION) private extService: ExtensionService,
  ) {
    super(filterService, svc, consoleEvents, dialogForm, extService);
  }

  override ngOnInit() {
    this.tabs = this.tabNames.getTabs('routers');
    this.svc.refreshData = this.refreshData;
    this.zacWrapperService.zitiUpdated.subscribe(() => {
      this.refreshData();
    });
    this.zacWrapperService.resetZacEvents();
    super.ngOnInit();
  }

  override ngOnDestroy() {
    this.closeModal();
    super.ngOnDestroy();
  }

  headerActionClicked(action: string) {
    switch(action) {
      case 'add':
        this.svc.openEditForm();
        break;
      case 'edit':
        this.svc.openUpdate();
        break;
      case 'delete':
        const selectedItems = this.rowData.filter((row) => {
          return row.selected;
        });
        const label = selectedItems.length > 1 ? 'transit routers' : 'transit router';
        this.openBulkDelete(selectedItems, label);
        break;
      default:
    }
  }

  closeModal(event?) {
    this.svc.sideModalOpen = false;
    if(event?.refresh) {
      this.refreshData();
    }
  }

  dataChanged(event) {
    this.formDataChanged = event;
  }

  tableAction(event: any) {
    if (this.extService?.listActions?.length > 0) {
      let extensionFound = false;
      this.extService?.listActions?.forEach((extAction) => {
        if (extAction?.action === event?.action) {
          extAction.callback(event.item);
          extensionFound = true;
        }
      });
      if (extensionFound) {
        return;
      }
    }
    switch(event?.action) {
      case 'toggleAll':
      case 'toggleItem':
        this.itemToggled(event.item)
        break;
      case 'update':
        this.svc.openEditForm(event?.item?.id);
        break;
      case 'create':
        this.svc.openEditForm();
        break;
      case 'delete':
        this.deleteItem(event.item)
        break;
      case 'download-enrollment':
        this.downloadJWT(event.item)
        break;
      case 'download-all':
        this.downloadAllItems();
        break;
      case 'download-selected':
        this.svc.downloadItems(this.selectedItems);
        break;
      case 're-enroll':
        this.svc.reenroll(event.item).then((result) => {
          this.refreshData(this.svc.currentSort);
        });
        break;
      default:
        break;
    }
  }

  downloadJWT(item: any) {
    const jwt = this.svc.getJWT(item);
    this.svc.downloadJWT(jwt, item.name);
  }

  deleteItem(item: any) {
    this.openBulkDelete([item], 'transit router');
  }

  canDeactivate() {
    if (this.formDataChanged && this.svc.sideModalOpen) {
      return confirm('You have unsaved changes. Do you want to leave this page and discard your changes or stay on this page?');
    }
    return true;
  }
}
