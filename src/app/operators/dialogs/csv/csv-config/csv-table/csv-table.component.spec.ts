import {ChangeDetectorRef} from '@angular/core';
import {async} from '@angular/core/testing';
import {CsvPropertiesService} from '../../csv-dialog/csv.properties.service';
import {CsvTableComponent, TYPING_TABLE_ID} from './csv-table.component';
import {FormsModule} from '@angular/forms';
import {MaterialModule} from '../../../../../material.module';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {ComponentFixtureSpecHelper} from '../../../../../spec/component-fixture-spec.helper';
import { HEADER_TABLE_ID, BODY_TABLE_ID } from './csv-table.component';
import 'hammerjs';
import {TestIdComponentDirective} from '../../../../../spec/test-id-component.directive';
import {FormStatus} from '../csv-properties/csv-properties.component';
import {Map} from 'immutable';
import {configureWaveTesting} from '../../../../../spec/wave-testing.configuration';

interface Setting {
    delimiter: string,
    isTextQualifier: boolean
}

interface TestCase {
    case_name: string,
    inputs: {
        data: {
            file: File,
            content: string,
            progress: number,
            isNull: boolean
        },
        cellSpacing: number,
        linesToParse: number
    },
    behavior(setting: Setting): {columns: number}
}

describe('Component: CsvTableComponent', () => {

    let service: CsvPropertiesService;
    let fixture: ComponentFixtureSpecHelper<CsvTableComponent>;
    let component: CsvTableComponent;

    let test_cases: TestCase[] = [
        {
            case_name: '3 col to 4 col',
            inputs: {
                data: {
                    file: new File(['"a,b",c,d\n"1,2",3,4'], 'test-file.csv', {lastModified : (new Date()).getDate(), type: 'csv'}),
                    content: '"a,b",c,d\n"1,2",3,4',
                    progress: 100,
                    isNull: false
                },
                cellSpacing: 10,
                linesToParse: 15
            },
            behavior(setting: Setting) {
                return {columns: setting.isTextQualifier ? 3 : 4}
            }
        },
        {
            case_name: '3 col to 4 col (long headers)',
            inputs: {
                data: {
                    file: new File(['"aaaaaaaaaaaaaaaaaaaa,bbbbbbbbbbbbbbbbbb",ccccccccccccccc,dddddddddddddd\n"1,2",3,4'],
                        'test-file.csv',
                        {lastModified : (new Date()).getDate(), type: 'csv'}
                    ),
                    content: '"aaaaaaaaaaaaaaaaaaaa,bbbbbbbbbbbbbbbbbb",ccccccccccccccc,dddddddddddddd\n"1,2",3,4',
                    progress: 100,
                    isNull: false
                },
                cellSpacing: 10,
                linesToParse: 15
            },
            behavior(setting: Setting) {
                return {columns: setting.isTextQualifier ? 3 : 4}
            }
        }
    ];

    for (let i = 0; i < test_cases.length; i++) {
        let test_case = test_cases[i];
        describe('Test Case: ' + test_case.case_name, () => {
            configureWaveTesting(() => {
                fixture = new ComponentFixtureSpecHelper<CsvTableComponent>({
                    declarations: [
                        CsvTableComponent,
                        TestIdComponentDirective
                    ],
                    imports: [
                        MaterialModule,
                        FormsModule,
                        BrowserAnimationsModule
                    ],
                    providers: [
                        CsvPropertiesService,
                        ChangeDetectorRef
                    ]
                }, CsvTableComponent, test_case.inputs);

                component = fixture.getComponentInstance();
                service = fixture.getInjected(CsvPropertiesService);
            });

            it('should parse and update correctly', () => {
                service.changeDataProperties({
                    delimiter: ',',
                    decimalSeparator: '.',
                    isTextQualifier: false,
                    textQualifier: '"',
                    isHeaderRow: true,
                    headerRow: 0,
                });
                let TABLE_WIDTH = test_case.behavior({
                    delimiter: ',',
                    isTextQualifier: false
                }).columns;
                fixture.detectChanges();
                expect(getHeader().length).toBe(TABLE_WIDTH);
                expect(numberOfTableColumns()).toBe(TABLE_WIDTH);
                service.changeDataProperties({
                    delimiter: ',',
                    decimalSeparator: '.',
                    isTextQualifier: true,
                    textQualifier: '"',
                    isHeaderRow: true,
                    headerRow: 0,
                });
                TABLE_WIDTH = test_case.behavior({
                    delimiter: ',',
                    isTextQualifier: true
                }).columns;
                fixture.detectChanges();
                expect(getHeader().length).toBe(TABLE_WIDTH);
                expect(numberOfTableColumns()).toBe(TABLE_WIDTH);
            });

            it('resizes table columns and synchronizes header and body widths when using custom headers', async(async () => {
                service.changeDataProperties({
                    delimiter: ',',
                    decimalSeparator: '.',
                    isTextQualifier: false,
                    textQualifier: '"',
                    isHeaderRow: false,
                    headerRow: 0,
                });
                const TABLE_WIDTH = test_case.behavior({
                    delimiter: ',',
                    isTextQualifier: false
                }).columns;
                fixture.detectChanges();
                let header_row = headerRow();
                let body_row = bodyRow();
                expect(tableWidthWithoutSpacers(header_row)).toBe(TABLE_WIDTH);
                expect(tableWidthWithoutSpacers(body_row)).toBe(TABLE_WIDTH);
                await fixture.whenStable();
                fixture.detectChanges();
                for (let i = 0; i < header_row.length; i++) {
                    expect(clientWidth(header_row[i])).toBe(
                        i % 2 === 0 ?
                            component.cellSizes[i] :
                            component.cellSpacing
                    ); // Test whether or not the table resizes to the given values.
                    expect(clientWidth(header_row[i])).toBe(clientWidth(body_row[i]));
                    // Test if body and header have synchronized cell widths.
                }
            }));

            it('resizes table when entering typing properties', async(async () => {
                service.changeFormStatus(FormStatus.TypingProperties);
                fixture.detectChanges();
                let header_row = headerRow();
                let body_row = bodyRow();
                let typing_row = typingRow();
                await fixture.whenStable();
                fixture.detectChanges();
                for (let i = 0; i < header_row.length; i++) {
                    expect(clientWidth(header_row[i])).toBe(clientWidth(body_row[i]));
                    expect(clientWidth(header_row[i])).toBe(clientWidth(typing_row[i]));
                    // Test if body, header and typing have synchronized cell widths.
                }
            }));
        });
    }

    function getHeader(): {value: string}[] {
        return component.header;
    };

    function numberOfTableColumns(): number {
        const table_rows = fixture.getElementsByTagName('tr');
        if (table_rows.length === 0) {
            return 0;
        }
        return tableWidthWithoutSpacers(table_rows[table_rows.length - 1].getElementsByTagName('td'));
    };

    function headerRow(): HTMLCollectionOf<HTMLTableCellElement> {
        let tables = fixture.getElementsByTagName('table') as NodeListOf<HTMLTableElement>;
        let header_table: HTMLTableElement;
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].getAttribute('ng-reflect-test_id') === HEADER_TABLE_ID) {
                header_table = tables[i];
            }
        }
        return header_table.getElementsByTagName('tr')[0].getElementsByTagName('td') as HTMLCollectionOf<HTMLTableCellElement>;
    };

    function bodyRow(): HTMLCollectionOf<HTMLTableCellElement> {
        let tables = fixture.getElementsByTagName('table') as NodeListOf<HTMLTableElement>;
        let body_table: HTMLTableElement;
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].getAttribute('ng-reflect-test_id') === BODY_TABLE_ID) {
                body_table = tables[i];
            }
        }
        return body_table.getElementsByTagName('tr')[0].getElementsByTagName('td') as HTMLCollectionOf<HTMLTableCellElement>;
    };

    function typingRow(): HTMLCollectionOf<HTMLTableCellElement> {
        let tables = fixture.getElementsByTagName('table') as NodeListOf<HTMLTableElement>;
        let typing_table: HTMLTableElement;
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].getAttribute('ng-reflect-test_id') === TYPING_TABLE_ID) {
                typing_table = tables[i];
            }
        }
        return typing_table.getElementsByTagName('tr')[0].getElementsByTagName('td') as HTMLCollectionOf<HTMLTableCellElement>;
    };

    function clientWidth(element: HTMLElement): number {
        return element.getBoundingClientRect().width;
    };

    function tableWidthWithoutSpacers(row: HTMLCollectionOf<HTMLTableCellElement>): number {
        return (row.length + 1) / 2
    }
});
