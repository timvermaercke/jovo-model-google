/// <reference types="tv4" />
import { JovoModel, JovoModelData, JovoModelDataV3, NativeFileInformation } from '@jovotech/model';
export declare class JovoModelGoogle extends JovoModel {
    static MODEL_KEY: string;
    static defaultLocale?: string;
    constructor(data?: JovoModelData, locale?: string, defaultLocale?: string);
    static fromJovoModel(model: JovoModelData | JovoModelDataV3, locale: string): NativeFileInformation[];
    static toJovoModel(inputFiles: NativeFileInformation[]): JovoModelData;
    static getValidator(model: JovoModelData | JovoModelDataV3): tv4.JsonSchema;
}
