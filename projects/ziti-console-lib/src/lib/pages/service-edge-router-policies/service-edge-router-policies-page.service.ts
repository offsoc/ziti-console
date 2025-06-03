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

import {Injectable, Inject} from "@angular/core";
import {cloneDeep, isEmpty} from 'lodash';
import moment from 'moment';
import {DataTableFilterService, FilterObj} from "../../features/data-table/data-table-filter.service";
import {ListPageServiceClass} from "../../shared/list-page-service.class";
import {
    TableColumnDefaultComponent
} from "../../features/data-table/column-headers/table-column-default/table-column-default.component";
import {CallbackResults} from "../../features/list-page-features/list-page-form/list-page-form.component";
import {SETTINGS_SERVICE, SettingsService} from "../../services/settings.service";
import {ZITI_DATA_SERVICE, ZitiDataService} from "../../services/ziti-data.service";
import {CsvDownloadService} from "../../services/csv-download.service";
import {EdgeRouterPolicy} from "../../models/edge-router-policy";
import {unset} from "lodash";
import {GrowlerModel} from "../../features/messaging/growler.model";
import {GrowlerService} from "../../features/messaging/growler.service";
import {MatDialog} from "@angular/material/dialog";
import {SettingsServiceClass} from "../../services/settings-service.class";
import {ExtensionService, SHAREDZ_EXTENSION} from "../../features/extendable/extensions-noop.service";
import {ActivatedRoute, Router} from "@angular/router";
import {TableCellNameComponent} from "../../features/data-table/cells/table-cell-name/table-cell-name.component";

@Injectable({
    providedIn: 'root'
})
export class ServiceEdgeRouterPoliciesPageService extends ListPageServiceClass {

    private paging = this.DEFAULT_PAGING;
    public modalType = 'service-edge-router-policy';

    serviceType = '';
    selectedEdgeRouterPolicy: any = new EdgeRouterPolicy();

    routerRoleAttributes = [];
    routerNamedAttributes = [];
    routerNamedAttributesMap = {};
    selectedRouterRoleAttributes = [];
    selectedRouterNamedAttributes = [];

    serviceRoleAttributes = [];
    serviceNamedAttributes = [];
    serviceNamedAttributesMap = {};
    selectedServiceRoleAttributes = [];
    selectedServiceNamedAttributes = [];

    columnFilters: any = {
        name: '',
        os: '',
        createdAt: '',
    };

    override menuItems = [
        {name: 'Edit', action: 'update'},
        {name: 'Delete', action: 'delete'},
    ]

    override tableHeaderActions = [
        {name: 'Download All', action: 'download-all'},
        {name: 'Download Selected', action: 'download-selected'},
    ]

    resourceType = 'service-edge-router-policies';
    constructor(
        @Inject(SETTINGS_SERVICE) settings: SettingsServiceClass,
        filterService: DataTableFilterService,
        @Inject(ZITI_DATA_SERVICE) private zitiService: ZitiDataService,
        override csvDownloadService: CsvDownloadService,
        private growlerService: GrowlerService,
        private dialogForm: MatDialog,
        @Inject(SHAREDZ_EXTENSION) private extService: ExtensionService,
        protected override router: Router
    ) {
        super(settings, filterService, csvDownloadService, extService, router);
        this.filterService.filtersChanged.subscribe(filters => {
            let routerFilter, serviceFilter, postureFilter;
            filters.forEach((filter) => {
                switch (filter.columnId) {
                    case 'edgeRouterRoles':
                        routerFilter = true;
                        break;
                    case 'serviceRoles':
                        serviceFilter = true;
                        break;
                    case 'postureRoles':
                        postureFilter = true;
                        break;
                }
            });
            if (!routerFilter) {
                this.selectedRouterRoleAttributes = [];
                this.selectedRouterNamedAttributes = [];
            }
            if (!serviceFilter) {
                this.selectedServiceRoleAttributes = [];
                this.selectedServiceNamedAttributes = [];
            }
        });
    }

    validate = (formData): Promise<CallbackResults> => {
        return Promise.resolve({ passed: true});
    }

    initTableColumns(): any {
        const createdAtHeaderComponentParams = {
            filterType: 'DATETIME',
        };
        const self = this;
        const routerRolesHeaderComponentParams = {
            filterType: 'ATTRIBUTE',
            enableSorting: true,
            getRoleAttributes: () => {
                return self.routerRoleAttributes;
            },
            getNamedAttributes: () => {
                return self.routerNamedAttributes;
            },
            getSelectedRoleAttributes: () => {
                return self.selectedRouterRoleAttributes;
            },
            getSelectedNamedAttributes: () => {
                return self.selectedRouterNamedAttributes;
            },
            setSelectedRoleAttributes: (attributes) => {
                self.selectedRouterRoleAttributes = attributes;
            },
            setSelectedNamedAttributes: (attributes) => {
                self.selectedRouterNamedAttributes = attributes;
            },
            getNamedAttributesMap: () => {
                return self.routerNamedAttributesMap;
            }
        };
        const serviceRolesHeaderComponentParams = {
            filterType: 'ATTRIBUTE',
            enableSorting: true,
            getRoleAttributes: () => {
                return self.serviceRoleAttributes;
            },
            getNamedAttributes: () => {
                return self.serviceNamedAttributes;
            },
            getSelectedRoleAttributes: () => {
                return self.selectedServiceRoleAttributes;
            },
            getSelectedNamedAttributes: () => {
                return self.selectedServiceNamedAttributes;
            },
            setSelectedRoleAttributes: (attributes) => {
                self.selectedServiceRoleAttributes = attributes;
            },
            setSelectedNamedAttributes: (attributes) => {
                self.selectedServiceNamedAttributes = attributes;
            },
            getNamedAttributesMap: () => {
                return self.serviceNamedAttributesMap;
            }
        };

        const semanticHeaderComponentParams = {
            filterType: 'SELECT',
            enableSorting: true,
            filterOptions: [
                { label: 'Any Of', value: 'AnyOf', columnId: 'semantic'},
                { label: 'All Of', value: 'AllOf', columnId: 'semantic' },
            ],
            getFilterOptions: () => {
                return semanticHeaderComponentParams.filterOptions;
            }
        };

        const typeHeaderComponentParams = {
            filterType: 'SELECT',
            enableSorting: true,
            filterOptions: [
                { label: 'Dial', value: 'Dial', columnId: 'type' },
                { label: 'Bind', value: 'Bind', columnId: 'type' },
            ],
            getFilterOptions: () => {
                return typeHeaderComponentParams.filterOptions;
            }
        };

        return [
            {
                colId: 'name',
                field: 'name',
                headerName: 'Name',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: this.headerComponentParams,
                cellRenderer: TableCellNameComponent,
                cellRendererParams: { pathRoot: this.basePath },
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.serviceType = 'advanced';
                    this.openEditForm(data.data.id);
                },
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
                sortable: true,
                filter: true,
                sortColumn: this.sort.bind(this),
                sortDir: 'asc',
                width: 300,
            },
            {
                colId: 'serviceRoles',
                field: 'serviceRoles',
                headerName: 'Service Attributes',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: serviceRolesHeaderComponentParams,
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.serviceType = '';
                    this.openEditForm(data.data.id);
                },
                resizable: true,
                cellRenderer: this.rolesRenderer,
                cellClass: 'nf-cell-vert-align tCol',
                sortable: false,
                filter: false,
            },
            {
                colId: 'edgeRouterRoles',
                field: 'edgeRouterRoles',
                headerName: 'Router Attributes',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: routerRolesHeaderComponentParams,
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.serviceType = '';
                    this.openEditForm(data.data.id);
                },
                resizable: true,
                cellRenderer: this.rolesRenderer,
                cellClass: 'nf-cell-vert-align tCol',
                sortable: false,
                filter: false,
            },
            {
                colId: 'semantic',
                field: 'semantic',
                headerName: 'Semantic',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: semanticHeaderComponentParams,
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.serviceType = '';
                    this.openEditForm(data.data.id);
                },
                resizable: true,
                cellRenderer: (row) => {
                    return row.data?.semantic === 'AnyOf' ? 'Any Of' : 'All Of';
                },
                cellClass: 'nf-cell-vert-align tCol',
                width: 100,
            },
            {
                colId: 'createdAt',
                field: 'createdAt',
                headerName: 'Created At',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: createdAtHeaderComponentParams,
                valueFormatter: this.createdAtFormatter,
                resizable: true,
                sortable: true,
                sortColumn: this.sort.bind(this),
                cellClass: 'nf-cell-vert-align tCol',
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.serviceType = '';
                    this.openEditForm(data.data.id);
                },
                hide: true
            },
            {
                colId: 'id',
                field: 'id',
                headerName: 'ID',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: this.headerComponentParams,
                cellRendererParams: { pathRoot: this.basePath, showIdentityIcons: true },
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.openEditForm(data?.data?.id);
                },
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
                sortable: true,
                filter: true,
                hide: true,
            },
        ];
    }

    getData(filters?: FilterObj[], sort?: any, page?: any): Promise<any> {
        // we can customize filters or sorting here before moving on...
        this.paging.page = page || this.paging.page;
        return super.getTableData('service-edge-router-policies', this.paging, filters, sort)
            .then((results: any) => {
                return this.processData(results);
            });
    }

    private processData(results: any) {
        if (!isEmpty(results?.data)) {
            //pre-process data before rendering
            results.data = this.addActionsPerRow(results);
        }
        if (!isEmpty(results?.meta?.pagination)) {
            this.totalCount = results.meta?.pagination.totalCount;
        }
        return results;
    }

    private addActionsPerRow(results: any): any[] {
        return results.data.map((row) => {
            row.actionList = ['update', 'delete'];
            return row;
        });
    }

    public getEdgeRouterRoleAttributes() {
        return this.zitiService.get('edge-router-role-attributes', {}, []).then((result) => {
            this.routerRoleAttributes = result.data;
            return result;
        });
    }

    public getServiceNamedAttributes() {
        return this.zitiService.get('services', {}, []).then((result) => {
            const namedAttributes = result.data.map((service) => {
                this.serviceNamedAttributesMap[service.name] = service.id;
                return service.name;
            });
            this.serviceNamedAttributes = namedAttributes;
            return namedAttributes;
        });
    }

    public getRouterNamedAttributes() {
        return this.zitiService.get('edge-routers', {}, []).then((result) => {
            const namedAttributes = result.data.map((router) => {
                this.serviceNamedAttributesMap[router.name] = router.id;
                return router.name;
            });
            this.routerNamedAttributes = namedAttributes;
            return namedAttributes;
        });
    }

    public getServiceRoleAttributes() {
        return this.zitiService.get('service-role-attributes', {}, []).then((result) => {
            this.serviceRoleAttributes = result.data;
            return result;
        });
    }


    public openUpdate(item?: any) {
        this.modalType = 'service-edge-router-policies';
        if (item) {
            this.selectedEdgeRouterPolicy = item;
            this.selectedEdgeRouterPolicy.badges = [];
            unset(this.selectedEdgeRouterPolicy, '_links');
        } else {
            this.selectedEdgeRouterPolicy = new EdgeRouterPolicy();
        }
        this.sideModalOpen = true;
    }
}
