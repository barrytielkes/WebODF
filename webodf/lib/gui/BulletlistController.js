/**
 * Copyright (C) 2013 KO GmbH <copyright@kogmbh.com>
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

/*global runtime, core, gui, Node, ops, odf */

/**
 * @constructor
 * @implements {core.Destroyable}
 * @implements {core.EventSource}
 * @param {!ops.Session} session
 * @param {!gui.EventManager} eventManager
 * @param {!gui.SessionConstraints} sessionConstraints
 * @param {!gui.SessionContext} sessionContext
 * @param {!string} inputMemberId
 */
gui.BulletlistController = function BulletlistController(
    session,
    eventManager,
    sessionConstraints,
    sessionContext,
    inputMemberId
    ) {
    "use strict";
    var odfUtils = odf.OdfUtils,
        odtDocument = session.getOdtDocument(),
        eventNotifier = new core.EventNotifier([
            gui.BulletlistController.enabledChanged
        ]),
        isEnabled = false;

    gui.BulletlistController.session = session;
    gui.BulletlistController.memberid = inputMemberId;

    /**
     * @return {undefined}
     */
    function updateEnabledState() {
        var /**@type{!boolean}*/newIsEnabled = true;

        if (sessionConstraints.getState(gui.CommonConstraints.EDIT.REVIEW_MODE) === true) {
            newIsEnabled = /**@type{!boolean}*/(sessionContext.isLocalCursorWithinOwnAnnotation());
        }

        if (newIsEnabled !== isEnabled) {
            isEnabled = newIsEnabled;
            eventNotifier.emit(gui.BulletlistController.enabledChanged, isEnabled);
        }
    }


    /**
     * @param {!ops.OdtCursor} cursor
     * @return {undefined}
     */
    function onCursorEvent(cursor) {
        if (cursor.getMemberId() === inputMemberId) {
            updateEnabledState();
        }
    }

    /**
     * @return {!boolean}
     */
    this.isEnabled = function () {
        return isEnabled;
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.subscribe = function (eventid, cb) {
        eventNotifier.subscribe(eventid, cb);
    };

    /**
     * @param {!string} eventid
     * @param {!Function} cb
     * @return {undefined}
     */
    this.unsubscribe = function (eventid, cb) {
        eventNotifier.unsubscribe(eventid, cb);
    };

    /**
     * Creates a bulletlist at the current position
     */
    function addBulletlist() {
        if(!isEnabled) {
            return
        }
        var selection = odtDocument.getCursorSelection(inputMemberId);
        var cursor = odtDocument.getCursor(inputMemberId);
        var paragraph = /**@type{!Element}*/(odfUtils.getParagraphElement(cursor.getNode()))
        var paragraphStyle = paragraph.getAttributeNS(odf.Namespaces.textns, "style-name") || "";

        var operations = [];
        var op = new ops.OpCreateBulletlist()
        op.init({
            memberid:inputMemberId,
            length:selection.length,
            position:selection.position
        });
        operations.push(op);
        session.enqueue(operations);
        
        eventManager["focus"]();

    }
    this.addBulletlist = addBulletlist;

    /**
     * Removes the bulletlist at the current position
     */
	function removeBulletlist() {
		if(!isEnabled) {
			return
		}
	}
	this.removeBulletlist = removeBulletlist;

    /**
     * @param {!function(!Error=)} callback, passing an error object in case of error
     * @return {undefined}
     */
    this.destroy = function (callback) {
        odtDocument.unsubscribe(ops.Document.signalCursorMoved, onCursorEvent);
        sessionConstraints.unsubscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        callback();
    };

    function init() {
        odtDocument.subscribe(ops.Document.signalCursorMoved, onCursorEvent);
        sessionConstraints.subscribe(gui.CommonConstraints.EDIT.REVIEW_MODE, updateEnabledState);
        updateEnabledState();
    }
    init();
}

/**@const*/gui.BulletlistController.enabledChanged = "enabled/changed";

/**
 * @param {!ops.OdtDocument} odtDocument
 * @param {string|undefined} memberId
 */
gui.BulletlistController.setDefaultStyle = function (odtDocument, memberId) {

    var ownerDocument = odtDocument.getDOMDocument();
    var op;
    var styleSheet = /**@type{!CSSStyleSheet}*/(odtDocument.getOdfCanvas().getStyleSheet().sheet);

    var rule = 'text|list > text|list-item > :not(text|list):first-child::before';
    rule += '{';
    rule += '   content: "•";';
    rule += '   counter-increment: X1-level1-1 1;';
    rule += '   text-align: left;';
    rule += '   display: inline-block;';
    rule += '   margin-left: 0.635cm;';
    rule += '   padding-right: 0.2cm;';
    rule += '}';
    styleSheet.insertRule(rule, styleSheet.cssRules.length);

    var styleTree = new odf.StyleTree(odtDocument.getOdfCanvas().odfContainer().rootElement.styles, odtDocument.getOdfCanvas().odfContainer().rootElement.automaticStyles).getStyleTree(),
        lists = /**@type{Array}*/(styleTree["list"]),
        listStyles = {}, // to store whitch styles are there and what there highest number is. number and bullet L1, L2, L3,... So {number: 2, bullet: 1}
        listStyleNumber,
        newListStyleName;

    for(var key in lists) {
        listStyleNumber = Number(key.substr(1));
        var name = /**@type{String}*/(lists[key]['element']['firstChild']['nodeName']);
        name = name.substr(name.lastIndexOf('-') + 1);

        if(!listStyles[name] || listStyles[name] < listStyleNumber) { // to make sure that the highest number is stored:
            listStyles[name] = listStyleNumber;
        }
    }

    if(memberId === undefined) {
        memberId = 'localuser';
    }

    if(!listStyles['bullet']) {
        // create bulletlist style in automaticStyles:
        newListStyleName = 'L'+ (listStyleNumber + 1);
        var listStyle = ownerDocument.createElementNS(odf.Namespaces.textns, "text:list-style");
        listStyle.setAttributeNS(odf.Namespaces.stylens, "style:name", newListStyleName);

        var listStyleChild = ownerDocument.createElementNS(odf.Namespaces.textns, "text:list-level-style-bullet");
        listStyleChild.setAttributeNS(odf.Namespaces.textns, "text:bullet-char", "•");
        listStyleChild.setAttributeNS(odf.Namespaces.textns, "text:level", "1");
        listStyleChild.setAttributeNS(odf.Namespaces.textns, "text:style-name", "Bullet_20_Symbols");
        listStyle.appendChild(listStyleChild);
        var listStyleChildChild = ownerDocument.createElementNS(odf.Namespaces.stylens, "style:list-level-properties");
        listStyleChildChild.setAttributeNS(odf.Namespaces.textns, "text:list-level-position-and-space-mode", "label-alignment");
        listStyleChild.appendChild(listStyleChildChild);
        var listStyleChildChildChild = ownerDocument.createElementNS(odf.Namespaces.stylens, "style:list-level-label-alignment");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.fons, "fo:margin-left", "1.27cm");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.fons, "fo:text-indent", "-0.635cm");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.textns, "text:label-followed-by", "listtab");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.textns, "text:list-tab-stop-position", "1.27cm");
        listStyleChildChild.appendChild(listStyleChildChildChild);

        odtDocument.getOdfCanvas().odfContainer().rootElement.automaticStyles.appendChild(listStyle);

        if(gui.BulletlistController.session) {
            var newStyleName = newListStyleName,
                setProperties = {};

            setProperties["style:list-style-name"] = newListStyleName;
            setProperties["style:list-parent-name"] = "Standard";

            op = new ops.OpAddStyle();
            op.init({
                memberid: memberId,
                styleName: 'P1',
                styleFamily: 'paragraph',
                isAutomaticStyle: true,
                setProperties: setProperties
            });
            gui.BulletlistController.session.enqueue([op]);
        }
        listStyleNumber += 1;
    }

    if(!listStyles['number']) {
        // create numberedlist style in automaticStyles:
        newListStyleName = 'L'+ (listStyleNumber + 1);
        var listStyle = ownerDocument.createElementNS(odf.Namespaces.textns, "text:list-style");
        listStyle.setAttributeNS(odf.Namespaces.stylens, "style:name", newListStyleName);

        var listStyleChild = ownerDocument.createElementNS(odf.Namespaces.textns, "text:list-level-style-number");
        listStyleChild.setAttributeNS(odf.Namespaces.stylens, "style:num-format", "1");
        listStyleChild.setAttributeNS(odf.Namespaces.stylens, "style:num-suffix", ".");
        listStyleChild.setAttributeNS(odf.Namespaces.textns, "text:level", "1");
        listStyleChild.setAttributeNS(odf.Namespaces.textns, "text:style-name", "Numbering_20_Symbols");
        listStyle.appendChild(listStyleChild);
        var listStyleChildChild = ownerDocument.createElementNS(odf.Namespaces.stylens, "style:list-level-properties");
        listStyleChildChild.setAttributeNS(odf.Namespaces.textns, "text:list-level-position-and-space-mode", "label-alignment");
        listStyleChild.appendChild(listStyleChildChild);
        var listStyleChildChildChild = ownerDocument.createElementNS(odf.Namespaces.stylens, "style:list-level-label-alignment");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.fons, "fo:margin-left", "1.27cm");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.fons, "fo:text-indent", "-0.635cm");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.textns, "text:label-followed-by", "listtab");
        listStyleChildChildChild.setAttributeNS(odf.Namespaces.textns, "text:list-tab-stop-position", "1.27cm");
        listStyleChildChild.appendChild(listStyleChildChildChild);

        odtDocument.getOdfCanvas().odfContainer().rootElement.automaticStyles.appendChild(listStyle);

        if(gui.BulletlistController.session) {
            var newStyleName = newListStyleName,
                setProperties = {};

            setProperties["style:list-style-name"] = newListStyleName;
            setProperties["style:list-parent-name"] = "Standard";

            op = new ops.OpAddStyle();
            op.init({
                memberid: memberId,
                styleName: 'P1',
                styleFamily: 'paragraph',
                isAutomaticStyle: true,
                setProperties: setProperties
            });
            gui.BulletlistController.session.enqueue([op]);
        }

    }

};
