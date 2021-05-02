import * as keywords from "./zxbasic-keywords.json";

export class ZxBasicKeyword {

    public static findKeyword(languageToken: string): any {

        languageToken = languageToken.replace(/\s/g, "");

        let regex = new RegExp(`^${languageToken}(\\s?\\(|\\s?or|$)`, "i");
        
        // find keyword        
        let keyword = keywords.find((item) => regex.test(item.keyword));

        return keyword;
    }
}