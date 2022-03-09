"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JovoModelGoogle = void 0;
const fs_1 = require("fs");
const model_1 = require("@jovotech/model");
const lodash_get_1 = __importDefault(require("lodash.get"));
const lodash_mergewith_1 = __importDefault(require("lodash.mergewith"));
const lodash_set_1 = __importDefault(require("lodash.set"));
const path_1 = require("path");
const yaml = __importStar(require("yaml"));
yaml.scalarOptions.str.defaultType = 'QUOTE_DOUBLE';
class JovoModelGoogle extends model_1.JovoModel {
    constructor(data, locale, defaultLocale) {
        super(data, locale);
        JovoModelGoogle.defaultLocale = defaultLocale;
    }
    static fromJovoModel(model, locale) {
        const errorPrefix = `/models/${locale}.json - `;
        const returnFiles = [];
        const globalIntents = {
            'actions.intent.MAIN': {
                handler: {
                    webhookHandler: 'Jovo',
                },
            },
        };
        if (!model.intents) {
            return [];
        }
        const intents = model_1.JovoModelHelper.getIntents(model);
        for (const [intentKey, intentData] of Object.entries(intents)) {
            const gaIntent = {
                trainingPhrases: [],
            };
            const path = ['custom', 'intents'];
            if (locale !== this.defaultLocale) {
                path.push(locale);
            }
            if (intentData.googleAssistant) {
                const googleIntent = Object.keys(intentData.googleAssistant)[0];
                const data = intentData.googleAssistant[googleIntent];
                if (googleIntent.startsWith('actions.intent')) {
                    globalIntents[googleIntent] = Object.keys(data).length
                        ? data
                        : { handler: { webhookHandler: 'Jovo' } };
                    continue;
                }
                else {
                    path.push(`${googleIntent}.yaml`);
                    Object.assign(gaIntent, intentData.googleAssistant[googleIntent]);
                }
            }
            else {
                path.push(`${intentKey}.yaml`);
                for (let phrase of intentData.phrases || []) {
                    const entityRegex = /{(.*?)}/g;
                    for (;;) {
                        const match = entityRegex.exec(phrase);
                        if (!match) {
                            break;
                        }
                        const matched = match[0];
                        const entity = match[1];
                        let type;
                        const entities = model_1.JovoModelHelper.getEntities(model, intentKey);
                        for (const [entityKey, entityData] of Object.entries(entities)) {
                            if (entity === entityKey) {
                                if (typeof entityData.type === 'object') {
                                    if (!entityData.type.googleAssistant) {
                                        throw new Error(`${errorPrefix}Please add a "googleAssistant" property for entity "${entityKey}"`);
                                    }
                                    type = entityData.type.googleAssistant;
                                    continue;
                                }
                                type = entityData.type;
                            }
                        }
                        if (!type) {
                            throw new Error(`Couldn't find entity type for entity ${entity} for intent ${intentKey}.`);
                        }
                        let sampleValue = '';
                        const entityTypes = model_1.JovoModelHelper.getEntityTypes(model);
                        for (const [entityTypeKey, entityTypeData] of Object.entries(entityTypes)) {
                            if (entityTypeKey !== type) {
                                continue;
                            }
                            const entityTypeDataValue = entityTypeData.values[0];
                            if (typeof entityTypeDataValue === 'string') {
                                sampleValue = entityTypeDataValue;
                            }
                            else {
                                sampleValue = entityTypeDataValue.value;
                            }
                            break;
                        }
                        if (!sampleValue) {
                            sampleValue = entity;
                        }
                        phrase = phrase.replace(matched, `($${entity} '${sampleValue}' auto=true)`);
                        if (type === 'actions.type.FreeText') {
                            model_1.JovoModelHelper.addEntityType(model, 'FreeTextType', {});
                            type = 'FreeTextType';
                        }
                        if (locale === this.defaultLocale && model_1.JovoModelHelper.hasEntities(model, intentKey)) {
                            if (!gaIntent.parameters) {
                                gaIntent.parameters = [];
                            }
                            if (gaIntent.parameters.find((el) => el.name === entity)) {
                                continue;
                            }
                            gaIntent.parameters.push({
                                name: entity,
                                type: {
                                    name: type,
                                },
                            });
                        }
                    }
                    gaIntent.trainingPhrases.push(phrase);
                }
            }
            returnFiles.push({
                path,
                content: yaml.stringify(gaIntent),
            });
            globalIntents[intentKey] = { handler: { webhookHandler: 'Jovo' } };
        }
        const entityTypes = model_1.JovoModelHelper.getEntityTypes(model);
        for (const [entityTypeKey, entityTypeData] of Object.entries(entityTypes)) {
            const gaInput = {
                synonym: {
                    entities: {},
                },
            };
            const path = ['custom', 'types'];
            if (locale !== this.defaultLocale) {
                path.push(locale);
            }
            path.push(`${entityTypeKey}.yaml`);
            for (const entityTypeValue of (entityTypeData.values || [])) {
                if (typeof entityTypeValue === 'string') {
                    gaInput.synonym.entities[entityTypeValue] = { synonyms: [entityTypeValue] };
                }
                else {
                    gaInput.synonym.entities[entityTypeValue.key || entityTypeValue.value] = {
                        synonyms: [
                            entityTypeValue.value,
                            ...(entityTypeValue.synonyms || [])
                        ]
                    };
                }
            }
            if (entityTypeKey === 'FreeTextType') {
                returnFiles.push({
                    path,
                    content: yaml.stringify({ freeText: {} }),
                });
            }
            else {
                returnFiles.push({
                    path,
                    content: yaml.stringify(gaInput),
                });
            }
        }
        for (const key of ['global', 'intents', 'types', 'scenes']) {
            const googleProps = (0, lodash_get_1.default)(model, `googleAssistant.custom.${key}`, {});
            if (key === 'global') {
                (0, lodash_mergewith_1.default)(googleProps, globalIntents, (objValue) => {
                    if (objValue) {
                        return objValue;
                    }
                });
            }
            for (const [name, content] of Object.entries(googleProps)) {
                const path = ['custom', key];
                if (key !== 'global' && locale !== this.defaultLocale) {
                    path.push(locale);
                }
                path.push(`${name}.yaml`);
                returnFiles.push({
                    path: path,
                    content: yaml.stringify(content),
                });
            }
        }
        return returnFiles;
    }
    static toJovoModel(inputFiles) {
        var _a, _b;
        const jovoModel = {
            version: '4.0',
            invocation: '',
            intents: {},
            entityTypes: {},
        };
        for (const inputFile of inputFiles) {
            const filePath = inputFile.path;
            const modelType = filePath[1];
            const modelName = filePath[filePath.length - 1].replace('.yaml', '');
            if (modelType === 'intents') {
                const intent = inputFile.content;
                const entityRegex = /\(\$([a-z]*).*?\)/gi;
                const phrases = [];
                const entities = {};
                for (let phrase of intent.trainingPhrases) {
                    for (;;) {
                        const match = entityRegex.exec(phrase);
                        if (!match) {
                            break;
                        }
                        const [matched, entityName] = match;
                        phrase = phrase.replace(matched, `{${entityName}}`);
                        let model = intent;
                        if (!model.parameters) {
                            const defaultModelPath = (0, path_1.join)(filePath[0], modelType, `${modelName}.yaml`);
                            const file = (0, fs_1.readFileSync)(defaultModelPath, 'utf-8');
                            const defaultModel = yaml.parse(file);
                            if (!defaultModel.parameters) {
                                const entityValue = matched.match(/'.*'/);
                                const entityPhrase = ((_a = entityValue === null || entityValue === void 0 ? void 0 : entityValue.shift()) === null || _a === void 0 ? void 0 : _a.replace(/'/g, '')) || entityName;
                                phrase = phrase.replace(`{${entityName}}`, entityPhrase);
                                continue;
                            }
                            model = defaultModel;
                        }
                        const entityParameter = model.parameters.find((el) => el.name === entityName);
                        const hasInput = !!entities[entityParameter.name];
                        if (!hasInput) {
                            if (entityParameter.type.name === 'FreeTextType') {
                                entities[entityParameter.name] = {
                                    type: {
                                        googleAssistant: 'actions.type.FreeText',
                                    },
                                };
                            }
                            else {
                                entities[entityParameter.name] = {
                                    type: entityParameter.type.name,
                                };
                            }
                        }
                    }
                    phrases.push(phrase);
                }
                const jovoIntent = { phrases };
                if (entities.length > 0) {
                    jovoIntent.entities = entities;
                }
                jovoModel.intents[modelName] = jovoIntent;
            }
            else if (modelType === 'types') {
                const entity = inputFile.content;
                const entities = ((_b = entity.synonym) === null || _b === void 0 ? void 0 : _b.entities) || {};
                const values = [];
                if (modelName === 'FreeTextType') {
                    continue;
                }
                for (const entityKey of Object.keys(entities)) {
                    const entityValues = entities[entityKey].synonyms;
                    const entityTypeValue = {
                        key: entityKey,
                        value: entityValues.shift(),
                        synonyms: entityValues,
                    };
                    values.push(entityTypeValue);
                }
                const jovoEntity = { values };
                jovoModel.entityTypes[modelName] = jovoEntity;
            }
            else {
                const props = (0, lodash_get_1.default)(jovoModel, `googleAssistant.custom.${modelType}`, {});
                (0, lodash_set_1.default)(props, [modelName], inputFile.content);
                (0, lodash_set_1.default)(jovoModel, `googleAssistant.custom.${modelType}`, props);
            }
        }
        return jovoModel;
    }
    static getValidator(model) {
        return super.getValidator(model);
    }
}
exports.JovoModelGoogle = JovoModelGoogle;
JovoModelGoogle.MODEL_KEY = 'google';
//# sourceMappingURL=JovoModelGoogle.js.map