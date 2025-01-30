import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnDestroy,
  Output,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  Inject
} from '@angular/core';
import {Subscription} from 'rxjs';
import {ProjectableForm} from "../projectable-form.class";
import {SETTINGS_SERVICE, SettingsService} from "../../../services/settings.service";

import {isEmpty, cloneDeep, invert} from 'lodash';
import {ZITI_DATA_SERVICE, ZitiDataService} from "../../../services/ziti-data.service";
import {GrowlerService} from "../../messaging/growler.service";
import {EdgeRouterPolicyFormService, EDGE_ROUTER_POLICY_EXTENSION_SERVICE} from './edge-router-policy-form.service';
import {MatDialogRef} from "@angular/material/dialog";
import {ExtensionService} from "../../extendable/extensions-noop.service";
import {GrowlerModel} from "../../messaging/growler.model";
import {EdgeRouterPolicy} from "../../../models/edge-router-policy";
import {ActivatedRoute, Router} from "@angular/router";
import {Location} from "@angular/common";

@Component({
  selector: 'lib-edge-router-policy-form',
  templateUrl: './edge-router-policy-form.component.html',
  styleUrls: ['./edge-router-policy-form.component.scss'],
  providers: [
    {
      provide: MatDialogRef,
      useValue: {}
    }
  ]
})
export class EdgeRouterPolicyFormComponent extends ProjectableForm implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  @Input() formData: EdgeRouterPolicy | any = {};
  @Output() close: EventEmitter<any> = new EventEmitter<any>();

  selectedEdgeRouterRoleAttributes = [];
  selectedEdgeRouterNamedAttributes = [];
  selectedIdentityRoleAttributes = [];
  selectedIdentityNamedAttributes = [];

  formView = 'simple';
  isEditing = false;
  edgeRoutersLoading = false;
  identitiesLoading = false;
  postureChecksLoading = false;

  settings: any = {};

  override entityType = 'edge-router-policies';
  override entityClass = EdgeRouterPolicy;

  constructor(
      @Inject(SETTINGS_SERVICE) protected override settingsService: SettingsService,
      public svc: EdgeRouterPolicyFormService,
      @Inject(ZITI_DATA_SERVICE) override zitiService: ZitiDataService,
      growlerService: GrowlerService,
      @Inject(EDGE_ROUTER_POLICY_EXTENSION_SERVICE) extService: ExtensionService,
      protected override router: Router,
      protected override route: ActivatedRoute,
      location: Location
  ) {
    super(growlerService, extService, zitiService, router, route, location, settingsService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.subscription.add(
        this.settingsService.settingsChange.subscribe((results:any) => {
          this.settings = results;
        })
    );
    if (isEmpty(this.formData.id)) {
      this.formData = new EdgeRouterPolicy();
    }
    this.initData = cloneDeep(this.formData);
    this.initSelectedAttributes();
    this.extService.updateFormData(this.formData);
    this.subscription.add(
        this.extService.formDataChanged.subscribe((data) => {
          if (data.isEmpty) {
            return;
          }
          this.formData = data;
        })
    );
    this.svc.edgeRouterNamedAttributesMap = this.svc.edgeRouterNamedAttributesMap;
    this.svc.identityNamedAttributesMap = this.svc.identityNamedAttributesMap;
    this.initData = cloneDeep(this.formData);
  }

  override entityUpdated() {
    this.loadAttributes();
    if (isEmpty(this.formData.id)) {
      this.formData = new EdgeRouterPolicy();
    }
    this.initData = cloneDeep(this.formData);
    this.initSelectedAttributes();
    this.extService.updateFormData(this.formData);
    this.subscription.add(
        this.extService.formDataChanged.subscribe((data) => {
          if (data.isEmpty) {
            return;
          }
          this.formData = data;
        })
    );
    this.svc.edgeRouterNamedAttributesMap = this.svc.edgeRouterNamedAttributesMap;
    this.svc.identityNamedAttributesMap = this.svc.identityNamedAttributesMap;
    this.initData = cloneDeep(this.formData);
  }

  ngOnDestroy() {
    this.extService.closed.emit({});
    this.subscription.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    this.isEditing = !isEmpty(this.formData.id);
  }

  loadAttributes() {
    const promises = [];
    promises.push(this.svc.getEdgeRouterRoleAttributes());
    promises.push(this.svc.getIdentityRoleAttributes());
    promises.push(this.svc.getEdgeRouterNamedAttributes());
    promises.push(this.svc.getIdentityNamedAttributes());
    Promise.all(promises).then(() => {
      this.initSelectedAttributes();
    });
  }

  initSelectedAttributes() {
    if (isEmpty(this.formData.id)) {
      this.svc.associatedEdgeRouters = [];
      this.svc.associatedEdgeRouterNames = [];
      this.svc.associatedIdentities = [];
      this.svc.associatedIdentityNames = [];
      return;
    }
    const edgeRouterIdAttributesMap = invert(this.svc.edgeRouterNamedAttributesMap);
    const identityIdAttributesMap = invert(this.svc.identityNamedAttributesMap);
    this.selectedEdgeRouterRoleAttributes = [];
    this.selectedEdgeRouterNamedAttributes = [];
    this.selectedIdentityRoleAttributes = [];
    this.selectedIdentityNamedAttributes = [];
    this.formData.edgeRouterRoles?.forEach(attr => {
      if (attr.indexOf('@') === 0) {
        this.selectedEdgeRouterNamedAttributes.push(edgeRouterIdAttributesMap[attr.substring(1)]);
      } else {
        this.selectedEdgeRouterRoleAttributes.push(attr.substring(1));
      }
    });
    this.formData.identityRoles?.forEach(attr => {
      if (attr.indexOf('@') === 0) {
        this.selectedIdentityNamedAttributes.push(identityIdAttributesMap[attr.substring(1)]);
      } else {
        this.selectedIdentityRoleAttributes.push(attr.substring(1));
      }
    });

    this.svc.getAssociatedEdgeRoutersByAttribute(this.selectedEdgeRouterRoleAttributes, this.selectedEdgeRouterNamedAttributes);
    this.svc.getAssociatedIdentitiesByAttribute(this.selectedIdentityRoleAttributes, this.selectedIdentityNamedAttributes);
  }

  headerActionRequested(action) {
    switch(action.name) {
      case 'save':
        this.save();
        break;
      case 'close':
        this.returnToListPage();
        break;
      case 'toggle-view':
        this.formView = action.data;
        break;
    }
  }

  async save(event?) {
    this.formData.name = this.formData.name.trim();
    const isValid = this.validate();
    const isExtValid = await this.extService.validateData();
    if(!isValid || !isExtValid) {
      const growlerData = new GrowlerModel(
          'error',
          'Error',
          `Data Invalid`,
          `Edge Router Policy data is invalid. Please update the highlighted fields and try again.`,
      );
      this.growlerService.show(growlerData);
      return;
    }

    this.isLoading = true;
    this.applySelectedAttributes();
    this.svc.save(this.formData).then((result) => {
      const data = result?.data?.id ? result.data : result;
      this._dataChange = false;
      if (!isEmpty(data.id)) {
        this.formData = data || this.formData;
        this.initData = this.formData;
      } else {
        this.initData = this.formData;
      }
      if (result?.close) {
        this.closeModal(true, true);
        this.returnToListPage();
      }
    }).finally(() => {
      this.isLoading = false;
    });
  }

  applySelectedAttributes() {
    this.formData.edgeRouterRoles = this.svc.getSelectedRoles(this.selectedEdgeRouterRoleAttributes, this.selectedEdgeRouterNamedAttributes, this.svc.edgeRouterNamedAttributesMap);
    this.formData.identityRoles = this.svc.getSelectedRoles(this.selectedIdentityRoleAttributes, this.selectedIdentityNamedAttributes, this.svc.identityNamedAttributesMap);
  }

  validate() {
    this.errors = {};
    if (isEmpty(this.formData.name)) {
      this.errors['name'] = true;
    }
    return isEmpty(this.errors);
  }

  apiActionRequested(action) {
    switch (action.id) {
      case 'cli':
        this.copyCLICommand();
        break;
      case 'curl':
        this.copyCURLCommand();
        break;
    }
  }

  copyCLICommand() {
    const erRoles = this.svc.getSelectedRoles(this.selectedEdgeRouterRoleAttributes, this.selectedEdgeRouterNamedAttributes, this.svc.edgeRouterNamedAttributesMap);
    let erRolesVar = this.getRolesCLIVariable(erRoles);

    const identityRoles = this.svc.getSelectedRoles(this.selectedIdentityRoleAttributes, this.selectedIdentityNamedAttributes, this.svc.identityNamedAttributesMap);
    let identityRolesVar = this.getRolesCLIVariable(identityRoles);

    const command = `ziti edge ${this.formData.id ? 'update' : 'create'} edge-router-policy ${this.formData.id ? `'${this.formData.id}'` : ''} ${this.formData.id ? '--name' : ''} '${this.formData.name}'${this.formData.id ? '' : ` --semantic '${this.formData.semantic}`} --edge-router-roles '${erRolesVar}' --identity-roles '${identityRolesVar}'`;

    navigator.clipboard.writeText(command);
    const growlerData = new GrowlerModel(
        'success',
        'Success',
        `Text Copied`,
        `CLI command copied to clipboard`,
    );
    this.growlerService.show(growlerData);
  }

  copyCURLCommand() {
    const erRoles = this.svc.getSelectedRoles(this.selectedEdgeRouterRoleAttributes, this.selectedEdgeRouterNamedAttributes, this.svc.edgeRouterNamedAttributesMap);
    let erRolesVar = this.getRolesCURLVariable(erRoles);

    const identityRoles = this.svc.getSelectedRoles(this.selectedIdentityRoleAttributes, this.selectedIdentityNamedAttributes, this.svc.identityNamedAttributesMap);
    let identityRolesVar = this.getRolesCURLVariable(identityRoles);

    const command = `curl '${this.apiCallURL}' \\
${this.formData.id ? '--request PATCH \\' : ''}
  -H 'accept: application/json' \\
  -H 'content-type: application/json' \\
  -H 'zt-session: ${this.settings.session.id}' \\
  --data-raw '{"name":"${this.formData.name}","edgeRouterRoles":${erRolesVar},"identityRoles":${identityRolesVar},"semantic":"${this.formData.semantic}"}'`;

    navigator.clipboard.writeText(command);
    const growlerData = new GrowlerModel(
        'success',
        'Success',
        `Text Copied`,
        `CURL command copied to clipboard`,
    );
    this.growlerService.show(growlerData);
  }

  get apiCallURL() {
    return this.settings.selectedEdgeController + '/edge/management/v1/edge-router-policies' + (this.formData.id ? `/${this.formData.id}` : '');
  }

  get apiData() {
    const data: any = {
      name: this.formData?.name || '',
      appData: this.formData?.appData || '',
      edgeRouterRoles: this.svc.getSelectedRoles(this.selectedEdgeRouterRoleAttributes, this.selectedEdgeRouterNamedAttributes, this.svc.edgeRouterNamedAttributesMap),
      identityRoles: this.svc.getSelectedRoles(this.selectedIdentityRoleAttributes, this.selectedIdentityNamedAttributes, this.svc.identityNamedAttributesMap),
      semantic: this.formData.semantic,
      type: this.formData.type,
      tags: this.formData.tags
    }
    return data;
  }

  _apiData = {};
  set apiData(data) {
    this._apiData = data;
  }

  clear(): void {
  }
}
