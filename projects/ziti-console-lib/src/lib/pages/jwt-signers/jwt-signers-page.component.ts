/*
    Copyright NetFoundry Inc.

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

import {Component, OnInit} from '@angular/core';
import {DataTableFilterService} from "../../features/data-table/data-table-filter.service";
import {JwtSignersPageService} from "./jwt-signers-page.service";
import {TabNameService} from "../../services/tab-name.service";
import {ListPageComponent} from "../../shared/list-page-component.class";
import {ConsoleEventsService} from "../../services/console-events.service";
import {MatDialog} from "@angular/material/dialog";
import {isEmpty} from "lodash";
import {ConfirmComponent} from "../../features/confirm/confirm.component";


@Component({
    selector: 'lib-jwt-signers',
    templateUrl: './jwt-signers-page.component.html',
    styleUrls: ['./jwt-signers-page.component.scss']
})
export class JwtSignersPageComponent extends ListPageComponent implements OnInit {
    title = 'JWT Signers'
    tabs: { url: string, label: string }[] ;
    isLoading: boolean;
    formDataChanged = false;
    _networkJwt: any;

    constructor(
        override svc: JwtSignersPageService,
        filterService: DataTableFilterService,
        private tabNames: TabNameService,
        consoleEvents: ConsoleEventsService,
        dialogForm: MatDialog
    ) {
        super(filterService, svc, consoleEvents, dialogForm);
    }

    override ngOnInit() {
        this.tabs = this.tabNames.getTabs('authentication');
        this.svc.refreshData = this.refreshData;
        this.svc.getNetworkJwt().then((result) => {
            if (isEmpty(result?.data)) {
                return;
            }
            this._networkJwt = result.data[0].token;
        });
        super.ngOnInit();
    }

    headerActionClicked(action: string) {
        switch (action) {
            case 'add':
                this.svc.openEditForm();
                break;
            case 'edit':
                this.svc.openEditForm();
                break;
            case 'delete':
                const selectedItems = this.rowData.filter((row) => {
                    return row.selected;
                });
                this.checkForAssociatedEntities(selectedItems);
                break;
            default:
        }
    }

    confirmAssociatedDelete(jwtSignersWithAssociations) {
        const title = jwtSignersWithAssociations.length > 1 ? 'JWT Signers In Use' : 'JWT Signer In Use';
        const label1 = jwtSignersWithAssociations.length > 1 ? 'The following external JWT signers are still in use by an auth policy and can not be deleted:' : 'The following external JWT signer is still in use by an auth policy and can not be deleted:';
        const label2 = jwtSignersWithAssociations.length > 1 ? 'To delete these external JWT signers, first remove them from any associated auth policies.' : 'To delete this external JWT signer, first remove it from any associated auth policies.';
        const names = jwtSignersWithAssociations.map((item) => {
            return item.name;
        });
        const data = {
            appendId: 'DeleteExtJWTSignersWithAssociations',
            title: title,
            message: label1,
            submessage: label2,
            bulletList: names,
            confirmLabel: 'Ok',
            imageUrl: '../../assets/svgs/Growl_Error.svg',
            showCancelLink: false
        };
        this.dialogRef = this.dialogForm.open(ConfirmComponent, {
            data: data,
            autoFocus: false,
        });
    }

    tableAction(event: any) {
        switch(event?.action) {
            case 'toggleAll':
            case 'toggleItem':
                this.itemToggled(event.item)
                break;
            case 'update':
                this.svc.openEditForm(event.item?.id);
                break;
            case 'create':
                this.svc.openEditForm();
                break;
            case 'delete':
                const selectedItems = [event.item];
                this.checkForAssociatedEntities(selectedItems);
                break;
            default:
                break;
        }
    }

    checkForAssociatedEntities(selectedItems) {
        this.svc.getTableData('auth-policies', this.svc.DEFAULT_PAGING).then((policies) => {
            const signersWithAssociations = [];
            this.selectedItems.forEach((signer) => {
                policies.data.forEach((policy) => {
                    if (policy.primary.extJwt?.allowedSigners?.includes(signer.id)) {
                        signersWithAssociations.push(signer);
                    } else if (policy.secondary.requireExtJwtSigner === signer.id) {
                        signersWithAssociations.push(signer);
                    }
                });
            });
            if (signersWithAssociations.length > 0) {
                this.confirmAssociatedDelete(signersWithAssociations);
            } else {
                const label = selectedItems.length > 1 ? 'external JWT signer' : 'external JWT signers';
                this.openBulkDelete(selectedItems, label);
            }
        });
    }

    deleteItem(item: any) {
        this.openBulkDelete([item], 'jwt-signer');
    }

    closeModal(event: any) {
        this.svc.sideModalOpen = false;
        if(event?.refresh) {
            this.refreshData();
        }
    }

    dataChanged(event) {
        this.formDataChanged = event;
    }

    get networkJwt() {
        return encodeURIComponent(this._networkJwt);
    }

    get networkJwtFilename() {
        let filename = 'network-jwt';
        if (this.svc?.currentSettings?.selectedEdgeController) {
            const urlObject = new URL(this.svc?.currentSettings?.selectedEdgeController);
            filename = urlObject.hostname;
        }
        return filename;
    }
}
