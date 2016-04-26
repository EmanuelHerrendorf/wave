import {Component, Input, Output, EventEmitter,
        OnChanges, SimpleChange, OnInit, ChangeDetectionStrategy} from "angular2/core";

import {MdPatternValidator, MdMinValueValidator, MdNumberRequiredValidator, MdMaxValueValidator,
        MATERIAL_DIRECTIVES} from "ng2-material/all";
import {MdDialogRef, MdDialogConfig} from "ng2-material/components/dialog/dialog";

import {FORM_DIRECTIVES, Validators, FormBuilder,
        ControlGroup, Control, ControlArray} from "angular2/common";

import {LayerMultiSelectComponent, ReprojectionSelectionComponent, OperatorContainerComponent,
        OperatorBaseComponent, toLetters, OperatorButtonsComponent} from "./operator.component";

import {LayerService} from "../../services/layer.service";

import {Layer} from "../../models/layer.model";
import {Operator, ResultType, ComplexOperatorParam} from "../../models/operator.model";
import {DataType, DataTypes} from "../../models/datatype.model";
import {Unit} from "../../models/unit.model";
import {Projection} from "../../models/projection.model";

/**
 * This component allows creating the expression operator.
 */
@Component({
    selector: "wave-raster-value-extraction",
    template: `
    <wave-operator-container title="Extract a Raster Value and Add it to the Vector Layer"
                            (add)="addLayer()" (cancel)="dialog.close()">
        <form [ngFormModel]="configForm">
            <wave-multi-layer-selection [layers]="layers" [min]="1" [max]="1"
                                        [type]="LAYER_IS_POINTS"
                                        (selectedLayers)="selectedPointLayer = $event[0]">
            </wave-multi-layer-selection>
            <wave-multi-layer-selection [layers]="layers" [min]="1" [max]="9"
                                        [type]="LAYER_IS_RASTER"
                                        (selectedLayers)="onSelectRasterLayers($event)">
            </wave-multi-layer-selection>
            <md-card>
                <md-card-header>
                    <md-card-header-text>
                        <span class="md-title">Configuration</span>
                        <span class="md-subheader">Specify the operator</span>
                    </md-card-header-text>
                </md-card-header>
                <md-card-content>
                    <div layout="row" ngControlGroup="valueNames">
                        <md-input-container class="md-block"
                                    *ngFor="#control of valueNamesControls.controls; #i = index">
                            <label>
                                Value Name for Raster {{toLetters(i+1)}}
                            </label>
                            <input md-input [ngFormControl]="control">
                            <div md-messages="valueNames">
                                <div md-message="required">You must specify a value name.</div>
                            </div>
                        </md-input-container>
                    </div>
                    <md-input-container class="md-block">
                        <label for="name">
                            Output Layer Name
                        </label>
                        <input md-input ngControl="name" [(value)]="name">
                        <div md-messages="name">
                            <div md-message="required">You must specify a layer name.</div>
                        </div>
                    </md-input-container>
                </md-card-content>
            </md-card>
        </form>
    </wave-operator-container>
    `,
    directives: [MATERIAL_DIRECTIVES, LayerMultiSelectComponent, ReprojectionSelectionComponent,
                 OperatorContainerComponent],
    changeDetection: ChangeDetectionStrategy.Default
})
export class RasterValueExtractionOperatorComponent extends OperatorBaseComponent {

    private configForm: ControlGroup;
    private valueNamesControls: ControlArray;

    private selectedPointLayer: Layer;
    private selectedRasterLayers: Array<Layer>;

    private resolutionX = 1024;
    private resolutionY = 1024;

    private toLetters = toLetters;

    constructor(private dialog: MdDialogRef, private formBuilder: FormBuilder) {
        super();
        console.log("RasterValueExtractionOperatorComponent", "constructor", this.layerService, dialog);

        this.valueNamesControls = formBuilder.array([]);
        this.configForm = formBuilder.group({
            "valueNames": this.valueNamesControls,
            "name": ["Points With Raster Values", Validators.required],
        });
    }

    ngOnInit() {
        super.ngOnInit();
    }

    ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
        super.ngOnChanges(changes);
    }

    private onSelectRasterLayers(layers: Array<Layer>) {
        console.log("onSelectRasterLayers", layers);

        let discrepancy = layers.length - this.valueNamesControls.length;
        if (discrepancy > 0) {
            for (let i = this.valueNamesControls.length; i < layers.length; i++) {
                this.valueNamesControls.push(this.formBuilder.control(
                    layers[i].name, Validators.required
                ));
            }
        } else if (discrepancy < 0) {
            for (let i = layers.length; i < this.valueNamesControls.length; i++) {
                this.valueNamesControls.removeAt(i);
            }
        }

        console.log("onSelectRasterLayers", this.valueNamesControls);

        this.selectedRasterLayers = layers;
    }

    private addLayer() {
        let pointOperator = this.selectedPointLayer.operator;
        let rasterOperators = this.selectedRasterLayers.map(layer => layer.operator);

        let valueNames = this.valueNamesControls.controls.map(control => control.value);

        let units = new Map<string, Unit>(pointOperator.units.entries());
        let dataTypes = new Map<string, DataType>(pointOperator.dataTypes.entries());

        for (let i = 0; i < rasterOperators.length; i++) {
            units.set(valueNames[i], rasterOperators[i].getUnit("value"));
            dataTypes.set(valueNames[i], rasterOperators[i].getDataType("value"));
        }

        let name: string = this.configForm.controls["name"].value;

        let operator = new Operator({
            operatorType: "raster_metadata_to_points",
            resultType: ResultType.POINTS,
            parameters: new Map<string, string | number | ComplexOperatorParam>()
                        .set("xResolution", this.resolutionX)
                        .set("yResolution", this.resolutionY)
                        .set("names", valueNames),
            projection: pointOperator.projection,
            attributes: ["value"],
            dataTypes: dataTypes,
            units: units,
            pointSources: [pointOperator],
            rasterSources: rasterOperators,
        });

        this.layerService.addLayer(new Layer({
            name: name,
            operator: operator,
        }));

        this.dialog.close();
    }

}
