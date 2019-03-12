
import {of as observableOf, Observable} from 'rxjs';
import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {MappingSource, MappingSourceRasterLayer, MappingTransform} from '../mapping-source.model';
import {Unit} from '../../../unit.model';
import {RasterSourceType} from '../../../types/raster-source-type.model';
import {ResultTypes} from '../../../result-type.model';
import {Projection, Projections} from '../../../projection.model';
import {DataType, DataTypes} from '../../../datatype.model';
import {RasterLayer} from '../../../../layers/layer.model';
import {
    MappingColorizerRasterSymbology} from '../../../../layers/symbology/symbology.model';
import {Operator} from '../../../operator.model';
import {ProjectService} from '../../../../project/project.service';
import {DataSource} from '@angular/cdk/table';
import {GdalParams, GdalSourceType} from '../../../types/gdal-source-type.model';
import {ExpressionType} from '../../../types/expression-type.model';
import {ColorBreakpointDict} from '../../../../colors/color-breakpoint.model';
import {ColorizerData, IColorizerData} from '../../../../colors/colorizer-data.model';

@Component({
    selector: 'wave-source-dataset',
    templateUrl: './source-dataset.component.html',
    styleUrls: ['./source-dataset.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})

export class SourceDatasetComponent implements OnInit {

    @Input() dataset: MappingSource;

    searchTerm: string; // TODO: this was needed to get prod build working...
    _useRawData = false;
    _showPreview = false;
    _showDescription = false;
    _channelSource: ChannelDataSource;
    _displayedColumns  = ['name', 'measurement'];

    /**
     * Transform the values of a colorizer to match the transformation of the raster transformation.
     * @param {IColorizerData} colorizerConfig
     * @param {MappingTransform} transform
     * @returns {IColorizerData}
     */
    static createAndTransformColorizer(colorizerConfig: IColorizerData, transform: MappingTransform): IColorizerData {
        if ( transform ) {
            const transformedColorizerConfig: IColorizerData = {
                type: colorizerConfig.type,
                breakpoints: colorizerConfig.breakpoints.map( (bp: ColorBreakpointDict) => {
                    return  {
                        value: (bp.value as number - transform.offset) * transform.scale,
                        rgba: bp.rgba
                    };
                })
            };
            return transformedColorizerConfig;
        } else {
            return colorizerConfig;
        }
    }

    constructor(
        private projectService: ProjectService,
    ) {

    }

    ngOnInit(): void {
        this._channelSource = new ChannelDataSource(this.dataset.rasterLayer);
    }

    valid_colorizer(channel: MappingSourceRasterLayer): IColorizerData {
        if (channel.colorizer) {
            return channel.colorizer;
        } else {
            return ColorizerData.grayScaleColorizer(this.valid_unit(channel));
        }
    }

    valid_unit(channel: MappingSourceRasterLayer): Unit {
        if (channel.hasTransform && !this.useRawData) {
            return channel.transform.unit;
        } else {
            return channel.unit;
        }
    }

    simple_add(channel: MappingSourceRasterLayer) {
        this.add(channel, channel.hasTransform && !this.useRawData )
    }

    add(channel: MappingSourceRasterLayer, doTransform: boolean) {
        const unit: Unit = channel.unit;
        const mappingTransformation = channel.transform;


        let operator;
        if (this.dataset.operator === GdalSourceType.TYPE) {
            operator = this.createGdalSourceOperator(channel, doTransform);
        } else if (this.dataset.operator === GdalSourceType.TYPE_EXT) {
            operator = this.createGdalSourceOperator(channel, doTransform, true);
        } else {
            operator = this.createMappingRasterDbSourceOperator(channel, doTransform);
        }

        let colorizerConfig = channel.colorizer;
        if (doTransform) {
            colorizerConfig = SourceDatasetComponent.createAndTransformColorizer(colorizerConfig, mappingTransformation);
        }

        const layer = new RasterLayer({
            name: channel.name,
            operator: operator,
            symbology: new MappingColorizerRasterSymbology({
                unit: (doTransform) ? channel.transform.unit : unit,
                colorizer: colorizerConfig,
            }),
        });
        this.projectService.addLayer(layer);
    }

    @Input('useRawData')
    set useRawData(useRawData: boolean) {
        this._useRawData = useRawData;
    }

    get useRawData(): boolean {
        return this._useRawData;
    }

    get channels(): Array<MappingSourceRasterLayer> {
        return this.dataset.rasterLayer
    }

    get channelDataSource(): ChannelDataSource {
        return this._channelSource;
    }

    get displayedColumns(): Array<String> {
        return this._displayedColumns;
    }

    isSingleLayerDataset(): boolean {
        return this.dataset.rasterLayer.length <= 1;
    }

    toggleImages() {
        this._showPreview = !this._showPreview;
    }

    toggleDescriptions() {
        this._showDescription = !this._showDescription;
    }

    toggleTransform() {
        this._useRawData = !this._useRawData;
    }

    /**
     * Creates a gdal_source operator and a wrapping expression operator to transform values if needed.
     * @param {MappingSourceRasterLayer} channel
     * @param {boolean} doTransform
     * @returns {Operator}
     */
    createGdalSourceOperator(channel: MappingSourceRasterLayer, doTransform: boolean, use_gdal_params: boolean = false): Operator {
        const sourceDataType = channel.datatype;
        const sourceUnit: Unit = channel.unit;
        let sourceProjection: Projection;
        if (channel.coords.crs) {
            sourceProjection = Projections.fromCode(channel.coords.crs);
        } else {
            throw new Error('No projection or EPSG code defined in [' + this.dataset.name + ']. channel.id: ' + channel.id);
        }

        let gdalParams: GdalParams = undefined;
        if (use_gdal_params) {
            gdalParams = {channels: []};
            gdalParams.channels[channel.id] = {
                unit: channel.unit,
                coords: channel.coords,
                datatype: channel.datatype,
                nodata: channel.nodata,
                file_name: channel.file_name,
                channel: channel.channel
            };
        }

        const operatorType = new GdalSourceType({
            channel: channel.id,
            sourcename: this.dataset.source,
            transform: doTransform, // TODO: user selectable transform?
            gdal_params: gdalParams,
        });

        const sourceOperator = new Operator({
            operatorType: operatorType,
            resultType: ResultTypes.RASTER,
            projection: sourceProjection,
            attributes: ['value'],
            dataTypes: new Map<string, DataType>().set('value', DataTypes.fromCode(sourceDataType)),
            units: new Map<string, Unit>().set('value', sourceUnit),
        });

        // console.log('doTransform', doTransform, 'unit', sourceUnit, 'expression', 'A', 'datatype', sourceDataType, 'channel', channel);
        if (doTransform && channel.hasTransform) {
            const transformUnit = channel.transform.unit;
            const transformDatatype = DataTypes.fromCode(channel.transform.datatype);

            const transformOperatorType = new ExpressionType({
                unit: transformUnit,
                expression: '(A -' + channel.transform.offset.toString() + ') *' + channel.transform.scale.toString(),
                datatype: transformDatatype,
            });

            const transformOperator = new Operator({
                operatorType: transformOperatorType,
                resultType: ResultTypes.RASTER,
                projection: sourceProjection,
                attributes: ['value'],
                dataTypes: new Map<string, DataType>().set('value', transformDatatype),
                units: new Map<string, Unit>().set('value', transformUnit),
                rasterSources: [sourceOperator],
            });
            return transformOperator;
        }

        return sourceOperator;
    }

    createMappingRasterDbSourceOperator(channel: MappingSourceRasterLayer, doTransform: boolean) {
        let dataType = channel.datatype;
        let unit: Unit = channel.unit;

        if (doTransform && channel.hasTransform) {
            unit = channel.transform.unit;
            dataType = channel.transform.datatype;
        }

        let sourceProjection: Projection;
        if (channel.coords.crs) {
            sourceProjection = Projections.fromCode(channel.coords.crs);
        } else {
            throw new Error('No projection or EPSG code defined in [' + this.dataset.name + ']. channel.id: ' + channel.id);
        }

        const operatorType = new RasterSourceType({
            channel: channel.id,
            sourcename: this.dataset.source,
            transform: doTransform, // TODO: user selectable transform?
        });

        const operator = new Operator({
            operatorType: operatorType,
            resultType: ResultTypes.RASTER,
            projection: sourceProjection,
            attributes: ['value'],
            dataTypes: new Map<string, DataType>().set('value', DataTypes.fromCode(dataType)),
            units: new Map<string, Unit>().set('value', unit),
        });

        return operator;
    }

}

class ChannelDataSource extends DataSource<MappingSourceRasterLayer> {
    private channels: Array<MappingSourceRasterLayer>;

    constructor(channels: Array<MappingSourceRasterLayer>) {
        super();
        this.channels = channels;
    }

    connect(): Observable<Array<MappingSourceRasterLayer>> {
        return observableOf(this.channels);
    }

    disconnect() {
    }
}
