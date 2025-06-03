import {Injectable, Inject, Component} from "@angular/core";
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
import {EdgeRouter} from "../../models/edge-router";
import {unset, forEach} from "lodash";
import {ITooltipAngularComp} from "ag-grid-angular";
import {ITooltipParams} from "ag-grid-community";
import {OSTooltipComponent} from "../../features/data-table/tooltips/os-tooltip.component";
import {GrowlerModel} from "../../features/messaging/growler.model";
import {GrowlerService} from "../../features/messaging/growler.service";
import {MatDialog} from "@angular/material/dialog";
import {SettingsServiceClass} from "../../services/settings-service.class";
import {EDGE_ROUTER_EXTENSION_SERVICE} from "../../features/projectable-forms/edge-router/edge-router-form.service";
import {ExtensionService} from "../../features/extendable/extensions-noop.service";
import {ConfirmComponent} from "../../features/confirm/confirm.component";
import {Router} from "@angular/router";
import {TableCellNameComponent} from "../../features/data-table/cells/table-cell-name/table-cell-name.component";

@Injectable({
    providedIn: 'root'
})
export class EdgeRoutersPageService extends ListPageServiceClass {

    private paging = this.DEFAULT_PAGING;
    public modalType = 'edge-router';

    override CSV_COLUMNS = [
        {label: 'Name', path: 'name'},
        {label: 'Attributes', path: 'roleAttributes'},
        {label: 'Verified', path: 'isVerified'},
        {label: 'Online', path: 'isOnline'},
        {label: 'Created', path: 'createdAt'},
        {label: 'Token', path: 'enrollmentToken'},
        {label: 'No Traversal', path: 'noTraversal'},
        {label: 'Host Name', path: 'hostname'},
        {label: 'Disabled', path: 'disabled'},
        {label: 'Tunneler Enabled', path: 'isTunnelerEnabled'},
        {label: 'OS', path: 'versionInfo.os'},
        {label: 'Architecture', path: 'versionInfo.arch'},
        {label: 'Version', path: 'versionInfo.version'},
        {label: 'Revision', path: 'versionInfo.revision'},
        {label: 'Fingerprint', path: 'fingerprint'},
        {label: 'ID', path: 'id'},
    ];

    selectedEdgeRouter: any = new EdgeRouter();
    columnFilters: any = {
        name: '',
        os: '',
        createdAt: '',
    };

    override menuItems = [
        {name: 'Edit', action: 'update'},
        {name: 'Download JWT', action: 'download-enrollment'},
        {name: 'Reset Enrollment', action: 'reset-enrollment'},
        {name: 'Re-Enroll', action: 're-enroll'},
        {name: 'Delete', action: 'delete'},
    ]

    override tableHeaderActions = [
        {name: 'Download All', action: 'download-all'},
        {name: 'Download Selected', action: 'download-selected'},
    ]

    resourceType = 'edge-routers';

    constructor(
        @Inject(SETTINGS_SERVICE) settings: SettingsServiceClass,
        filterService: DataTableFilterService,
        @Inject(ZITI_DATA_SERVICE) private zitiService: ZitiDataService,
        override csvDownloadService: CsvDownloadService,
        private growlerService: GrowlerService,
        private dialogForm: MatDialog,
        @Inject(EDGE_ROUTER_EXTENSION_SERVICE) private extService: ExtensionService,
        protected override router: Router
    ) {
        super(settings, filterService, csvDownloadService, extService, router);
    }

    validate = (formData): Promise<CallbackResults> => {
        return Promise.resolve({ passed: true});
    }

    initTableColumns(): any {
        this.initMenuActions();

        const nameRenderer = (row) => {
            return `<div class="col cell-name-renderer" data-id="${row?.data?.id}">
                <span class="circle ${row?.data?.isVerified}" title="Verified Status"></span>
                <span class="circle ${row?.data?.isOnline}" title="Online Status"></span>
                <strong>${row?.data?.name}</strong>
              </div>`;
        }

        const rolesRenderer = (row) => {
            let roles = '';
            row?.data?.roleAttributes?.forEach((attr) => {
                roles += '<div class="hashtag">'+attr+'</div>';
            });
            return roles;
        }

        const osRenderer = (row) => {
            const osMap: any = {
                'darwin': 'apple',
                'linux': 'linux',
                'android': 'android',
                'windows': 'windows'
            }
            let os = "other";
            forEach(osMap, (value, key) => {
                if (row?.data?.versionInfo?.osVersion?.toLowerCase().indexOf(key)>=0 ||
                    row?.data?.versionInfo?.os.toLowerCase().indexOf(key)>=0) {
                    os = value;
                }
            });
            return `<div class="col desktop" data-id="${row?.data?.id}" style="overflow: unset;">
                <span class="os ${os}" data-balloon-pos="up"></span>
              </div>`
        }

        const enrollmentTokenFormatter = (row) => {
            const token = row?.data?.enrollmentToken;
            if (token) {
                if (moment(row?.data?.enrollmentExpiresAt).isBefore()) {
                    return 'Enrollment Expired';
                } else {
                    return token;
                }
            } else {
                return '';
            }
        };

        const columnFilters = this.columnFilters;

        const osParams = {
            filterType: 'COMBO',
            filterOptions: [
                { label: 'All', value: '', icon: 'empty' },
                { label: 'Apple', value: 'darwin', icon: 'apple' },
                { label: 'Windows', value: 'mingw', icon: 'windows'  },
                { label: 'Linux', value: 'linux', icon: 'linux'  },
                { label: 'Android', value: 'android', icon: 'android'  },
                { label: 'Other (text search)', value: '', icon: 'other', useTextInput: true  },
            ],
            columnFilters,
        };

        let tableColumns = [
            {
                colId: 'name',
                field: 'name',
                headerName: 'Name',
                headerComponent: TableColumnDefaultComponent,
                headerComponentParams: this.headerComponentParams,
                cellRenderer: TableCellNameComponent,
                cellRendererParams: { pathRoot: this.basePath, showRouterIcons: true },
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
                sortColumn: this.sort.bind(this),
                sortDir: 'asc'
            },
            {
                colId: 'os',
                field: 'versionInfo.os',
                headerName: 'O/S',
                width: 100,
                cellRenderer: osRenderer,
                headerComponent: TableColumnDefaultComponent,
                tooltipComponent: OSTooltipComponent,
                tooltipField: 'versionInfo.os',
                tooltipComponentParams: { color: '#ececec' },
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
            },
            {
                colId: 'roleAttributes',
                field: 'roleAttributes',
                headerName: 'Roles',
                headerComponent: TableColumnDefaultComponent,
                onCellClicked: (data) => {
                    if (this.hasSelectedText()) {
                        return;
                    }
                    this.openEditForm(data?.data?.id);
                },
                resizable: true,
                cellRenderer: this.rolesRenderer,
                cellClass: 'nf-cell-vert-align tCol',
                sortable: false,
                filter: false,
            },
            {
                colId: 'verified',
                field: 'isVerified',
                headerName: 'Verified',
                width: 100,
                sortable: true,
                headerComponent: TableColumnDefaultComponent,
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
            },
            {
                colId: 'online',
                field: 'isOnline',
                headerName: 'Online',
                width: 100,
                headerComponent: TableColumnDefaultComponent,
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
            },
            {
                colId: 'createdAt',
                field: 'createdAt',
                headerName: 'Created At',
                headerComponent: TableColumnDefaultComponent,
                valueFormatter: this.createdAtFormatter,
                resizable: true,
                sortable: true,
                sortColumn: this.sort.bind(this),
                cellClass: 'nf-cell-vert-align tCol',
            },
            {
                colId: 'enrollmentToken',
                field: 'enrollmentToken',
                headerName: 'Token',
                headerComponent: TableColumnDefaultComponent,
                valueFormatter: enrollmentTokenFormatter,
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
            },
            {
                colId: 'jwt',
                field: 'enrollmentJwt',
                headerName: 'JWT',
                headerComponent: TableColumnDefaultComponent,
                cellRenderer: 'cellTokenComponent',
                resizable: true,
                cellClass: 'nf-cell-vert-align tCol',
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

        if (this.extService.processTableColumns) {
            tableColumns = this.extService.processTableColumns(tableColumns);
        }

        return tableColumns;
    }

    getData(filters?: FilterObj[], sort?: any, page?: any): Promise<any> {
        // we can customize filters or sorting here before moving on...
        this.paging.page = page || this.paging.page;
        return super.getTableData('edge-routers', this.paging, filters, sort)
            .then((results: any) => {
                return this.processData(results);
            });
    }

    private processData(results: any) {
        if (!isEmpty(results?.data)) {
            //pre-process data before rendering
            results.data = this.addActionsPerRow(results);
        }
        return results;
    }

    private addActionsPerRow(results: any): any[] {
        return results.data.map((row) => {
            row.actionList = ['update', 're-enroll', 'delete'];
            if (this.hasEnrolmentToken(row)) {
                row.actionList.push('download-enrollment');
            }
            this.addListItemExtensionActions(row);
            return row;
        });
    }

    hasEnrolmentToken(item) {
        return !isEmpty(item?.enrollmentJwt);
    }

    public getEdgeRouterRoleAttributes() {
        return this.zitiService.get('edge-router-role-attributes', {}, []);
    }


    getJWT(identity: any) {
        return identity.enrollmentJwt;
    }

    downloadJWT(jwt, name) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:application/ziti-jwt;charset=utf-8,' + encodeURIComponent(jwt));
        element.setAttribute('download', name+".jwt");
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    reenroll(router: any) {
        const data = {
            appendId: 'ReenrollRouter',
            title: 'Re-Enroll Router',
            message: `<p>If the router is currently connected, it will be disconnected until the enrollment process is completed with the newly generated JWT. <p> Are you sure you want to re-enroll the selected router?`,
            confirmLabel: 'Yes',
            cancelLabel: 'Oops, no get me out of here',
            showCancelLink: true
        };
        this.dialogRef = this.dialogForm.open(ConfirmComponent, {
            data: data,
            autoFocus: false,
        });
        return this.dialogRef.afterClosed().toPromise().then((result) => {
            if (result?.confirmed) {
                return this.zitiService.post(`edge-routers/${router.id}/re-enroll`, {}, true).then((result) => {
                    const growlerData = new GrowlerModel(
                        'success',
                        'Success',
                        `Re-enroll Confirmed`,
                        `Router re-enroll was sent. A new enrollment token is now available`,
                    );
                    this.growlerService.show(growlerData);
                });
            } else {
                return Promise.resolve();
            }
        });
    }

    public openUpdate(item?: any) {
        this.modalType = 'edge-router';
        if (item) {
            this.selectedEdgeRouter = item;
            this.selectedEdgeRouter.badges = [];
            if (this.selectedEdgeRouter.isOnline) {
                this.selectedEdgeRouter.badges.push({label: 'Online', class: 'online', circle: 'true'});
            } else {
                this.selectedEdgeRouter.badges.push({label: 'Offline', class: 'offline', circle: 'false'});
            }
            if (!this.selectedEdgeRouter.isVerified) {
                this.selectedEdgeRouter.badges.push({label: 'Unverified', class: 'unreg'});
            }
            // TODO: implement when metrics and dialog features are available
            /*this.selectedEdgeRouterZ.moreActions = [
                {name: 'open-metrics', label: 'Open Metrics'},
                {name: 'dial-logs', label: 'Dial Logs'},
                {name: 'dial-logs', label: 'View Events'},
            ];*/
            unset(this.selectedEdgeRouter, '_links');
        } else {
            this.selectedEdgeRouter = new EdgeRouter();
        }
        this.sideModalOpen = true;
    }
}
