/**
 * Copyright (C) 2012-2013 KO GmbH <copyright@kogmbh.com>
 *
 * @licstart
 * This file is part of WebODF.
 *
 * WebODF is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License (GNU AGPL)
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * WebODF is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with WebODF.  If not, see <http://www.gnu.org/licenses/>.
 * @licend
 *
 * @source: http://www.webodf.org/
 * @source: https://github.com/kogmbh/WebODF/
 */

/*global ops, odf, core, runtime, Node */

/**
 * @constructor
 * @implements ops.Operation
 */
ops.OpCreateList = function OpCreateList() {
    "use strict";

    var memberid,
        timestamp,
        position,
        length,
        listType,
        domUtils = core.DomUtils,
        odfUtils = odf.OdfUtils;

    /**
     * @param {!ops.OpCreateList.InitSpec} data
     */
    this.init = function (data) {
        memberid = data.memberid;
        timestamp = data.timestamp;
        position = data.position;
        listType = data.listType;
    };

    this.isEdit = true;
    this.group = undefined;

    /**
     * @param {!ops.Document} document
     */
    this.execute = function (document) {
        var paragraph;
        var odtDocument = /**@type{ops.OdtDocument}*/(document),
            ownerDocument = odtDocument.getDOMDocument(),
            range = odtDocument.convertCursorToDomRange(position, 0),
            styleSheet = /**@type{!CSSStyleSheet}*/(odtDocument.getOdfCanvas().getStyleSheet().sheet),
            /**@type{!Array.<!Element>}*/
            modifiedParagraphs = [],
            rule,
            textNodes = odfUtils.getTextNodes(range, true);

        // create the automatedStyles:
        gui.ListController.setDefaultStyle(odtDocument, memberid);

        // get a list of the used styles.
        var listStyles = gui.ListController.getStyles(odtDocument);

        // check which counter-id to use:
        // first collect all list elements:
        var listElements = ownerDocument.querySelectorAll("list");
        var counterIdList = [];

        // collect current used counter-id values:
        for (var i = 0; i < listElements.length; i++) {
            counterIdList.push(listElements[i]['attributes']['counter-id']['nodeValue']);
        };

        // generate a uniqe number for the counter-id:
        var counterIdNumber = 1;
        while(counterIdList.indexOf('X'+ counterIdNumber +'-level1-1') != -1){
            counterIdNumber++;
        }

        // create the list dom elements:
        var list = ownerDocument.createElementNS(odf.Namespaces.textns, 'text:list');
        var listItem = ownerDocument.createElementNS(odf.Namespaces.textns, 'text:list-item');
        list.setAttributeNS(odf.Namespaces.textns, 'text:style-name', 'L'+ String(listStyles[listType]));
        list.setAttributeNS('urn:webodf:names:helper', 'counter-id', 'X'+ String(counterIdNumber) +'-level1-1');
        list.appendChild(listItem);

        if (textNodes.length > 0) { // make list item from paragraph: (when the get list function is called and the cursor is inside a paragraph)
            paragraph = odfUtils.getParagraphElement(textNodes[0]);
            paragraph.parentNode.insertBefore(list, paragraph);
            listItem.appendChild(paragraph);
            if (modifiedParagraphs.indexOf(paragraph) === -1) {
                modifiedParagraphs.push(paragraph);
            }
        } else { // create a empty list (when the cursor is in a empty paragraph)
            range.startContainer.parentNode.insertBefore(list, range.startContainer);
            range.startOffset = 0;
            listItem.appendChild(range.startContainer);
        }

        // there should be some link here with the ListStylesToCss > applyListStyles. But i could not get that working.
        // So i inject css  manuel here:
        rule = 'text|list[webodfhelper|counter-id=\"X'+ String(counterIdNumber) +'-level1-1\"] > text|list-item:first-child {';
        rule += '   counter-reset: X'+ String(counterIdNumber) +'-level1-1 1;';
        rule += '}';
        styleSheet.insertRule(rule, styleSheet.cssRules.length);

        rule = 'text|list[webodfhelper|counter-id=\"X'+ String(counterIdNumber) +'-level1-1\"] > text|list-item:first-child > *:first-child:not(text|list)::before {';
        rule += '   counter-increment: X'+ String(counterIdNumber) +'-level1-1 0;';
        rule += '}';
        styleSheet.insertRule(rule, styleSheet.cssRules.length);

        rule = 'text|list[webodfhelper|counter-id=\"X'+ String(counterIdNumber) +'-level1-1\"] > text|list-item > :not(text|list):first-child::before';
        rule += '{';
        if(listType === 'number') {
            rule += '   content:   counter(X'+ String(counterIdNumber) +'-level1-1, decimal) \".\";';
        } else {
            rule += '   content: "•";';
        }
        rule += '   counter-increment: X'+ String(counterIdNumber) +'-level1-1;';
        rule += '   text-align: left;';
        rule += '   display: inline-block;';
        rule += '   margin-left: 0.635cm;';
        rule += '   padding-right: 0.2cm;';
        rule += '}';
        styleSheet.insertRule(rule, styleSheet.cssRules.length);

        odtDocument.fixCursorPositions();
        odtDocument.getOdfCanvas().refreshSize();
        odtDocument.getOdfCanvas().rerenderAnnotations();
        modifiedParagraphs.forEach(function (paragraph) {
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraph,
                memberId: memberid,
                timeStamp: timestamp
            });
        });

        // refresh the document:
        var iterator = odtDocument.getIteratorAtPosition(position);
        var paragraphNode = odf.OdfUtils.getParagraphElement(iterator.container());
        if (paragraphNode) {
            odtDocument.getOdfCanvas().refreshSize();
            odtDocument.emit(ops.OdtDocument.signalParagraphChanged, {
                paragraphElement: paragraphNode,
                timeStamp: undefined,
                memberId: memberid
            });
            odtDocument.getOdfCanvas().rerenderAnnotations();
        }

        return true;
    };

    /**
     * @return {!ops.OpCreateList.Spec}
     */
    this.spec = function () {
        return {
            optype: "CreateList",
            memberid: memberid,
            timestamp: timestamp,
            position: position,
            listType: listType
        };
    };
};
/**@typedef{{
    optype:string,
    memberid:string,
    timestamp:number,
    position:number,
    listType:string
}}*/
ops.OpCreateList.Spec;
/**@typedef{{
    memberid:string,
    timestamp:(number|undefined),
    position:number,
    listType:string
}}*/
ops.OpCreateList.InitSpec;
