import {Component, Input, OnChanges, SimpleChange, ChangeDetectionStrategy} from "angular2/core";
import ol from "openlayers";

import Config from "../../models/config.model";
import {Operator} from "../../models/operator.model";
import {Projection} from "../../models/projection.model";
import {Symbology, AbstractVectorSymbology, RasterSymbology} from "../../models/symbology.model";

import {MappingQueryService, WFSOutputFormats} from "../../services/mapping-query.service";

import moment from "moment";

/**
 * The `ol-layer` component represents a single layer object of openLayer 3.
 *
 * # Input Variables
 * * layerType
 * * url
 * * params
 * * style
 */
@Component({
    selector: "ol-layer",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush
})
export abstract class OlMapLayerComponent<OlLayer extends ol.layer.Layer,
                                          OlSource extends ol.source.Source,
                                          S extends Symbology> implements OnChanges {

    @Input() operator: Operator;
    @Input() projection: Projection;
    @Input() symbology: S;
    @Input() time: moment.Moment;

    protected _mapLayer: OlLayer;
    protected source: OlSource;

    constructor(protected mappingQueryService: MappingQueryService) {}

    get mapLayer(): OlLayer { return this._mapLayer; };

    protected isFirstChange(changes: { [propName: string]: SimpleChange }): boolean {
        for (const property in changes) {
            if (changes[property].isFirstChange()) {
                return true;
            }
        }
        return false;
    }

    abstract ngOnChanges(changes: { [propName: string]: SimpleChange }): void;

    abstract get extent(): number[];
}

abstract class OlVectorLayerComponent extends OlMapLayerComponent<ol.layer.Vector,
                                                                  ol.source.Vector,
                                                                  AbstractVectorSymbology> {
    constructor(protected mappingQueryService: MappingQueryService) {
        super(mappingQueryService);
    }

    ngOnChanges(changes: { [propName: string]: SimpleChange }) {
        if (changes["operator"] || changes["projection"] || changes["time"]) {
            this.source = new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                url: this.mappingQueryService.getWFSQueryUrl(
                    this.operator,
                    this.time,
                    this.projection,
                    WFSOutputFormats.JSON
                ),
                wrapX: false,
            });
        }

        if (this.isFirstChange(changes)) {
            this._mapLayer = new ol.layer.Vector({
                source: this.source,
                style: this.symbology.olStyle,
            });
        } else {
            if (changes["operator"] || changes["projection"] || changes["time"]) {
                this.mapLayer.setSource(this.source);
            }
            if (changes["symbology"]) {
                this.mapLayer.setStyle(this.symbology.olStyle);
            }
        }
    }

    get extent() {
        return this.source.getExtent();
    }
}

@Component({
    selector: "ol-point-layer",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OlPointLayerComponent extends OlVectorLayerComponent {
    constructor(protected mappingQueryService: MappingQueryService) {
        super(mappingQueryService);
    }
}

@Component({
    selector: "ol-line-layer",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OlLineLayerComponent extends OlVectorLayerComponent {
    constructor(protected mappingQueryService: MappingQueryService) {
        super(mappingQueryService);
    }
}

@Component({
    selector: "ol-polygon-layer",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OlPolygonLayerComponent extends OlVectorLayerComponent {
    constructor(protected mappingQueryService: MappingQueryService) {
        super(mappingQueryService);
    }
}

@Component({
    selector: "ol-raster-layer",
    template: "",
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OlRasterLayerComponent extends OlMapLayerComponent<ol.layer.Tile,
                                                                ol.source.TileWMS,
                                                                RasterSymbology> {
    constructor(protected mappingQueryService: MappingQueryService) {
        super(mappingQueryService);
    }

    ngOnChanges(changes: { [propName: string]: SimpleChange }) {
        if (this.isFirstChange(changes)) {
            this.source = new ol.source.TileWMS({
                url: Config.MAPPING_URL,
                params: this.mappingQueryService.getWMSQueryParameters(
                    this.operator,
                    this.time,
                    this.projection
                ),
                wrapX: false,
            });

            this._mapLayer = new ol.layer.Tile({
                source: this.source,
                opacity: this.symbology.opacity,
            });
        } else {
            if (changes["operator"] || changes["projection"] || changes["time"]) {
                // TODO: add these functions to the typings file.
                (<any> this.source).updateParams(
                    this.mappingQueryService.getWMSQueryParameters(
                        this.operator,
                        this.time,
                        this.projection
                    )
                );
                (<any> this.source).refresh();
            }
            if (changes["symbology"]) {
                this._mapLayer.setOpacity(this.symbology.opacity);
                // this._mapLayer.setHue(rasterSymbology.hue);
                // this._mapLayer.setSaturation(rasterSymbology.saturation);
            }
        }
    }

    get extent() {
        return this._mapLayer.getExtent();
    }
}