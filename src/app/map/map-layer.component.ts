import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit, Output,
    SimpleChange
} from '@angular/core';
import {Subscription} from 'rxjs';

import {Layer as OlLayer, Tile as OlLayerTile, Vector as OlLayerVector} from 'ol/layer';
import {Source as OlSource, Tile as OlTileSource, TileWMS as OlTileWmsSource, Vector as OlVectorSource} from 'ol/source';

import {Projection} from '../operators/projection.model';
import {AbstractVectorSymbology, MappingColorizerRasterSymbology, Symbology} from '../layers/symbology/symbology.model';

import {StyleCreator} from './style-creator';
import {Layer, RasterData, RasterLayer, VectorData, VectorLayer} from '../layers/layer.model';
import {MappingQueryService} from '../queries/mapping-query.service';
import {Time} from '../time/time.model';
import {Config} from '../config.service';
import {ProjectService} from '../project/project.service';
import {LoadingState} from '../project/loading-state.model';
import {isNullOrUndefined} from 'util';

/**
 * The `ol-layer` component represents a single layer object of openLayer 3.
 *
 * # Input Variables
 * * layerType
 * * url
 * * params
 * * style
 */
export abstract class MapLayerComponent<OL extends OlLayer,
    OS extends OlSource,
    S extends Symbology,
    L extends Layer<S>>
    implements OnChanges {

    // TODO: refactor

    @Input() layer: L;
    @Input() projection: Projection;
    @Input() symbology: S;
    @Input() time: Time;
    @Input() visible = true;

    @Output() mapRedraw = new EventEmitter();

    protected source: OS;

    protected _mapLayer: OL;

    protected constructor(protected projectService: ProjectService) {
    }

    get mapLayer(): OL {
        return this._mapLayer;
    };

    abstract ngOnChanges(changes: { [propName: string]: SimpleChange }): void;

    abstract getExtent(): [number, number, number, number];
}

export abstract class OlVectorLayerComponent extends MapLayerComponent<OlLayerVector,
    OlVectorSource,
    AbstractVectorSymbology,
    VectorLayer<AbstractVectorSymbology>> implements OnInit, OnChanges, OnDestroy {

    private dataSubscription: Subscription;

    protected constructor(protected projectService: ProjectService) {
        super(projectService);
        this.source = new OlVectorSource({wrapX: false});
        this._mapLayer = new OlLayerVector({
            source: this.source,
            updateWhileAnimating: true,
        });
    }

    ngOnInit() {
        this.dataSubscription = this.projectService.getLayerDataStream(this.layer).subscribe((x: VectorData) => {
            this.source.clear(); // TODO: check if this is needed always...
            if (!isNullOrUndefined(x)) {
                this.source.addFeatures(x.data);
            }
        })
    }

    ngOnChanges(changes: { [propName: string]: SimpleChange }) {

        if (changes['visible']) {
            this.mapLayer.setVisible(this.visible);

            this.mapRedraw.emit();
        }

        if (changes['symbology']) {
            const style = StyleCreator.fromVectorSymbology(this.symbology);
            this.mapLayer.setStyle(style);
        }
    }

    ngOnDestroy() {
        if (this.dataSubscription) {
            this.dataSubscription.unsubscribe();
        }
    }

    getExtent() {
        return this.source.getExtent();
    }
}

@Component({
    selector: 'wave-ol-point-layer',
    template: '',
    providers: [{provide: MapLayerComponent, useExisting: OlPointLayerComponent}],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OlPointLayerComponent extends OlVectorLayerComponent {
    constructor(protected projectService: ProjectService) {
        super(projectService);
    }
}

@Component({
    selector: 'wave-ol-line-layer',
    template: '',
    providers: [{provide: MapLayerComponent, useExisting: OlLineLayerComponent}],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OlLineLayerComponent extends OlVectorLayerComponent {
    constructor(protected projectService: ProjectService) {
        super(projectService);
    }
}

@Component({
    selector: 'wave-ol-polygon-layer',
    template: '',
    providers: [{provide: MapLayerComponent, useExisting: OlPolygonLayerComponent}],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OlPolygonLayerComponent extends OlVectorLayerComponent {
    constructor(protected projectService: ProjectService) {
        super(projectService);
    }
}

@Component({
    selector: 'wave-ol-raster-layer',
    template: '',
    providers: [{provide: MapLayerComponent, useExisting: OlRasterLayerComponent}],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OlRasterLayerComponent extends MapLayerComponent<OlLayerTile, OlTileSource,
    MappingColorizerRasterSymbology, RasterLayer<MappingColorizerRasterSymbology>> implements OnChanges, OnInit {

    private dataSubscription: Subscription;

    constructor(protected projectService: ProjectService,
                protected mappingQueryService: MappingQueryService,
                private config: Config) {
        super(projectService);
    }

    ngOnInit() {
        // closure variables for checking the old state
        let data = undefined;
        let time = undefined;

        this.dataSubscription = this.projectService.getLayerDataStream(this.layer).subscribe((rasterData: RasterData) => {
            if (isNullOrUndefined(rasterData)) {
                // console.log("OlRasterLayerComponent constructor", rasterData);
                return;
            }

            if (this.source) {
                if (time !== rasterData.time.asRequestString()) {
                    // console.log("time", time, rasterData.time.asRequestString());

                    this.source.updateParams({
                        time: rasterData.time.asRequestString(),
                        colors: this.symbology.mappingColorizerRequestString()
                    });
                    time = rasterData.time.asRequestString();
                }
                if (this.source.getProjection().getCode() !== rasterData.projection.getCode()) {
                    // console.log("projection", this.source.getProjection().getCode, rasterData.projection.getCode());

                    // unfortunally there is no setProjection function, so reset the whole source
                    this.source = new OlTileWmsSource({
                        url: rasterData.data,
                        params: {
                            time: rasterData.time.asRequestString(),
                            colors: this.symbology.mappingColorizerRequestString()
                        },
                        projection: rasterData.projection.getCode(),
                        wrapX: false,
                    });

                    if (this._mapLayer) {
                        this._mapLayer.setSource(this.source);
                    }
                }
                if (data !== rasterData.data) {
                    // console.log("data", data, rasterData.data);

                    this.source.setUrl(rasterData.data);
                    data = rasterData.data;
                }

                if (this.config.MAP.REFRESH_LAYERS_ON_CHANGE) {
                    this.source.refresh();
                }
            } else {
                this.source = new OlTileWmsSource({
                    url: rasterData.data,
                    params: {
                        time: rasterData.time.asRequestString(),
                        colors: this.symbology.mappingColorizerRequestString()
                    },
                    projection: rasterData.projection.getCode(),
                    wrapX: false,
                });
                data = rasterData.data;
                time = rasterData.time.asRequestString();
            }

            if (this._mapLayer) {
                this._mapLayer.setSource(this.source);
            } else {
                this._mapLayer = new OlLayerTile({
                    source: this.source,
                    opacity: this.symbology.opacity,
                });
            }

        });

        // TILE LOADING STATE
        let tilesPending = 0;

        this.source.on('tileloadstart', () => {
            tilesPending++;
            this.projectService.changeRasterLayerDataStatus(this.layer, LoadingState.LOADING);
        });
        this.source.on('tileloadend', () => {
            tilesPending--;
            if (tilesPending <= 0) {
                this.projectService.changeRasterLayerDataStatus(this.layer, LoadingState.OK);
            }
        });
        this.source.on('tileloaderror', () => {
            tilesPending--;
            this.projectService.changeRasterLayerDataStatus(this.layer, LoadingState.ERROR);
        });
    }

    ngOnChanges(changes: { [propName: string]: SimpleChange }) {
        if (this._mapLayer) {
            if (changes['visible']) {
                this._mapLayer.setVisible(this.visible);

                this.mapRedraw.emit();
            }

            if (changes['symbology']) {
                this._mapLayer.setOpacity(this.symbology.opacity);
                // this._mapLayer.setHue(rasterSymbology.hue);
                // this._mapLayer.setSaturation(rasterSymbology.saturation);
                this.source.updateParams({
                    colors: this.symbology.mappingColorizerRequestString()
                })
            }
        }
    }

    getExtent() {
        return this._mapLayer.getExtent();
    }
}
