import {OperatorType, OperatorTypeDict, OperatorTypeMappingDict} from '../operator-type.model';
import {Coords, MappingCoordsDict} from '../dialogs/data-repository/mapping-source.model';
import {Unit, UnitDict, UnitMappingDict} from '../unit.model';

export interface GdalParams {
    channels: {
        unit: Unit,
        coords: Coords,
        datatype: string,
        nodata: number,
        file_name: string,
        channel: number
    }[]
}

interface GdalParamsDict {
    channels: {
        unit: UnitDict,
        coords: Coords,
        datatype: string,
        nodata: number,
        file_name: string,
        channel: number
    }[]
}

interface GdalParamsMappingDict {
    channels: {
        unit: UnitMappingDict,
        coords: MappingCoordsDict,
        datatype: string,
        nodata: number,
        file_name: string,
        channel: number
    }[]
}

interface GdalSourceTypeConfig {
    channel: number;
    sourcename: string;
    transform: boolean;
    gdal_params?: GdalParams;
}

interface GdalSourceTypeMappingDict extends OperatorTypeMappingDict {
    channel: number;
    sourcename: string;
    transform: boolean;
    gdal_params?: GdalParamsMappingDict;
}

export interface GdalSourceTypeDict extends OperatorTypeDict  {
    channel: number;
    sourcename: string;
    transform: boolean;
    gdal_params?: GdalParamsDict;
}

/**
 * The raster source type.
 */
export class GdalSourceType extends OperatorType {
    private static _TYPE_EXT = 'gdal_ext_source';
    private static _TYPE = 'gdal_source';
    private static _ICON_URL = OperatorType.createIconDataUrl(GdalSourceType._TYPE);
    private static _NAME = 'GDAL Source';

    static get TYPE_EXT(): string { return GdalSourceType._TYPE_EXT; }
    static get TYPE(): string { return GdalSourceType._TYPE; }
    static get ICON_URL(): string { return GdalSourceType._ICON_URL; }
    static get NAME(): string { return GdalSourceType._NAME; }

    private channel: number;
    private sourcename: string;
    private transform: boolean;
    private gdalParams: GdalParams | undefined;

    static fromDict(dict: GdalSourceTypeDict): GdalSourceType {
        const gdal_params = dict.gdal_params ? GdalSourceType.gdalParamsFromGdalParamsDict(dict.gdal_params) : undefined;
        const config: GdalSourceTypeConfig = {
            channel: dict.channel,
            sourcename: dict.sourcename,
            transform: dict.transform,
            gdal_params: gdal_params,
        };
        return new GdalSourceType(config);
    }

    static gdalParamsFromGdalParamsDict(paramsDict: GdalParamsDict): GdalParams {
        const gdal_params: GdalParams = {
            channels: paramsDict.channels.map(d => {
                if (d) {
                    return {
                        unit: Unit.fromDict(d.unit),
                        coords: d.coords,
                        datatype: d.datatype,
                        nodata: d.nodata,
                        file_name: d.file_name,
                        channel: d.channel
                    };
                } else {
                    return undefined; // FIXME: this prob requires a sanity check!
                }
            })
        };
        return gdal_params;
    }

    constructor(config: GdalSourceTypeConfig) {
        super();
        this.channel = config.channel;
        this.sourcename = config.sourcename;
        this.transform = config.transform;
        this.gdalParams = config.gdal_params ? config.gdal_params : undefined;
    }

    getMappingName(): string {
        return GdalSourceType.TYPE;
    }

    getIconUrl(): string {
        return GdalSourceType.ICON_URL;
    }

    toString(): string {
        return GdalSourceType.NAME;
    }

    getParametersAsStrings(): Array<[string, string]> {
        return [
            ['channel', this.channel.toString()],
            ['sourcename', this.sourcename.toString()],
            ['transform', this.transform.toString()],
        ];
    }

    toMappingDict(): GdalSourceTypeMappingDict {
        const mappingDict = {
            sourcename: this.sourcename,
            channel: this.channel,
            transform: this.transform
        };
        if (this.gdalParams) {
            mappingDict['gdal_params'] = this.getGdalParamsMappingDict();
        }
        return mappingDict;
    }

    toDict(): GdalSourceTypeDict {
        const dict = {
            operatorType: GdalSourceType.TYPE,
            sourcename: this.sourcename,
            channel: this.channel,
            transform: this.transform,
        };
        if (this.gdalParams) {
            dict['gdal_params'] = this.getGdalParamsDict();
        }
        return dict;
    }

    getGdalParamsDict(): GdalParamsDict {
        const gdalParamsDict: GdalParamsDict = {
            channels: this.gdalParams.channels.map( p => {
                if (p) {
                    return {
                        unit: p.unit.toDict(),
                        coords: p.coords,
                        datatype: p.datatype,
                        nodata: p.nodata,
                        file_name: p.file_name,
                        channel: p.channel
                    };
                } else {
                    return undefined; // FIXME: this prob requires a sanity check!
                }
            })
        };
        return gdalParamsDict;
    }

    getGdalParamsMappingDict(): GdalParamsMappingDict {
        const gdalParamsMappingDict: GdalParamsMappingDict = {
            channels: this.gdalParams.channels.map( p => {
                if (p) {
                    return {
                        unit: p.unit.toMappingDict(),
                        coords: p.coords,
                        datatype: p.datatype,
                        nodata: p.nodata,
                        file_name: p.file_name,
                        channel: p.channel
                    };
                } else {
                    return undefined; // FIXME: this prob requires a sanity check!
                }
            })
        };
        return gdalParamsMappingDict;
    }

}
