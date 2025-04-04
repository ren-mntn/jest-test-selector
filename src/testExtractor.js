"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTestCases = extractTestCases;
var fs = require("fs");
var util = require("util");
var readFile = util.promisify(fs.readFile);
/**
 * ファイルからJestのテストケースを抽出する
 * @param filePath テストファイルのパス
 * @returns テストケース情報の配列
 */
function extractTestCases(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var content, lines, testCases, describeStack, i, line, describeMatch, testMatch, testName, currentDescribePath, fullName, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, readFile(filePath, 'utf-8')];
                case 1:
                    content = _a.sent();
                    lines = content.split('\n');
                    testCases = [];
                    describeStack = [];
                    for (i = 0; i < lines.length; i++) {
                        line = lines[i];
                        describeMatch = line.match(/describe\(\s*['"](.+?)['"]/);
                        if (describeMatch) {
                            describeStack.push(describeMatch[1]);
                            continue;
                        }
                        // describeブロックの終了検出
                        if (line.includes('});') && describeStack.length > 0) {
                            describeStack.pop();
                            continue;
                        }
                        testMatch = line.match(/(?:test|it)(?:\.only)?\(\s*['"](.+?)['"]/);
                        if (testMatch) {
                            testName = testMatch[1];
                            currentDescribePath = __spreadArray([], describeStack, true);
                            fullName = __spreadArray(__spreadArray([], currentDescribePath, true), [testName], false).join(' > ');
                            testCases.push({
                                name: testName,
                                describePath: currentDescribePath,
                                fullName: fullName,
                                lineNumber: i + 1
                            });
                        }
                    }
                    return [2 /*return*/, testCases];
                case 2:
                    error_1 = _a.sent();
                    console.error('テストケース抽出エラー:', error_1);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
