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
gui.ListController = function ListController(
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
            gui.ListController.enabledChanged
        ]),
        isEnabled = false;

    gui.ListController.session = session;
    gui.ListController.memberid = inputMemberId;

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
            eventNotifier.emit(gui.ListController.enabledChanged, isEnabled);
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
     * @param {!string} listType //should be 'bullet' or 'number'
     */
    function addList(listType) {
        if(!isEnabled) {
            return
        }
        var selection = odtDocument.getCursorSelection(inputMemberId);
        var cursor = odtDocument.getCursor(inputMemberId);
        var paragraph = /**@type{!Element}*/(odfUtils.getParagraphElement(cursor.getNode()))
        var paragraphStyle = paragraph.getAttributeNS(odf.Namespaces.textns, "style-name") || "";

        var operations = [];
        var op = new ops.OpCreateList();
        op.init({
            memberid:inputMemberId,
            length:selection.length,
            position:selection.position,
            listType:listType
        });
        operations.push(op);
        session.enqueue(operations);
        eventManager["focus"]();

    }
    this.addList = addList;

    /**
     * Removes the bulletlist at the current position
     */
	function removeList() {
		if(!isEnabled) {
			return
		}
	}
	this.removeList = removeList;

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

/**@const*/gui.ListController.enabledChanged = "enabled/changed";

/**
 * @param {!ops.OdtDocument} odtDocument
 * @return {Object}
 */
gui.ListController.getStyles = function (odtDocument) {
    var styleTree = new odf.StyleTree(odtDocument.getOdfCanvas().odfContainer().rootElement.styles, odtDocument.getOdfCanvas().odfContainer().rootElement.automaticStyles).getStyleTree(),
        lists = /**@type{Array}*/(styleTree["list"]),
        listStyles = {}, // to store whitch styles are there and what there highest number is. number and bullet L1, L2, L3,... So {number: 2, bullet: 1}
        listStyleNumber = 0;
    for(var key in lists) {
        listStyleNumber = Number(key.substr(1));
        var name = /**@type{String}*/(lists[key]['element']['firstChild']['nodeName']);
        name = name.substr(name.lastIndexOf('-') + 1);

        if(!listStyles[name] || listStyles[name] < listStyleNumber) { // to make sure that the highest number is stored:
            listStyles[name] = listStyleNumber;
        }
    }
    listStyles.currentNumber = listStyleNumber;
    return listStyles;
}
/**
 * @param {!ops.OdtDocument} odtDocument
 * @param {string|undefined} memberId
 */
gui.ListController.setDefaultStyle = function (odtDocument, memberId) {

    var ownerDocument = odtDocument.getDOMDocument(),
        op,
        listStyles,
        newListStyleName;

    if(memberId === undefined) {
        memberId = 'localuser';
    }

    listStyles = gui.ListController.getStyles(odtDocument);
    if(!listStyles['bullet']) {
        // create bulletlist style in automaticStyles:
        newListStyleName = 'L'+ String(Number(listStyles['currentNumber']) + 1);
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

        if(gui.ListController.session) {
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
            gui.ListController.session.enqueue([op]);
        }
        listStyles.currentNumber = Number(listStyles['currentNumber']) + 1;
    }

    if(!listStyles['number']) {
        // create numberedlist style in automaticStyles:
        newListStyleName = 'L'+ String(Number(listStyles['currentNumber']) + 1);
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

        if(gui.ListController.session) {
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
            gui.ListController.session.enqueue([op]);
        }

    }

    listStyles = gui.ListController.getStyles(odtDocument);
};
