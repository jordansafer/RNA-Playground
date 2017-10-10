/*
University of Freiburg WS 2017/2018
Chair for Bioinformatics
Supervisor: Martin Raden
Author: Alexander Mattheis
*/

"use strict";

(function () {  // namespace
    // public methods
    namespace("postProcessing.visualizer", Visualizer,
        shareInformation, showFlow,
        showTraceback, highlight, downloadTable, replaceInfinityStrings, redrawOverlay, removeAllContents);

    // instances
    var visualizerInstance;

    /**
     * Contains functions for visualization
     * and helper functions which easify the access on information.
     * @constructor
     */
    function Visualizer() {
        visualizerInstance = this;

        // variables
        this.algorithm = {};

        this.cellLines = [];
        this.container = document.getElementById("overlay");

        this.lastFlows = [];
        this.lastPath = [];
        this.lastRowNumber = -1;

        this.input = {};
        this.output = {};

        this.svg = createSVG();

        // bindings
        ko.bindingHandlers.drawChar = {
            update: function (element, valueAccessor) {
                var values = ko.unwrap(valueAccessor());
                var character = values[0];
                var index = values[1];

                if (character !== undefined)
                    element.innerHTML = character.toUpperCase() + SUB.START_TAG + index + SUB.END_TAG;
            }
        };

        // public methods (linking)
        this.shareInformation = shareInformation;
        this.showFlow = showFlow;
        this.showTraceback = showTraceback;
        this.highlight = highlight;
        this.downloadTable = downloadTable;
        this.replaceInfinityStrings = replaceInfinityStrings;
        this.redrawOverlay = redrawOverlay;
        this.removeAllContents = removeAllContents;
    }

    /**
     * Creates fundamental SVG code, to draw SVGs on top of the webpage.
     * @return {Element} - SVG code which is used by drawLine()-function, to draw an arrow.
     */
    function createSVG() {
        var svg = document.createElementNS(SVG.NAME_SPACE, "svg");
        svg.appendChild(createEndMarker(SVG.TRACEBACK_LONG_ARROW_COLOR, SVG.MARKER.ID_TRACEBACK));
        svg.appendChild(createEndMarker(SVG.FLOW_LONG_ARROW_COLOR, SVG.MARKER.ID_FLOW));
        return svg;
    }

    /**
     * Creates the end piece of a line.
     * @param color {string} - The color of the marker.
     * @param id {string} - The id of the marker with which the marker can be accessed.
     * @return {Element} - The marker-Element (XML-code Object).
     * @see Created with the help of <marker> definition https://developer.mozilla.org/de/docs/Web/SVG/Element/marker
     */
    function createEndMarker(color, id) {
        // create triangle
        var trianglePath = document.createElementNS(SVG.NAME_SPACE, "path");
        trianglePath.setAttribute("d", SVG.TRIANGLE.D);  // triangle path
        trianglePath.setAttribute("fill", color);

        // create marker object using path defined above
        var markerEnd = document.createElementNS(SVG.NAME_SPACE, "marker");
        markerEnd.setAttribute("id", id);
        markerEnd.setAttribute("orient", SVG.MARKER.ORIENT);
        markerEnd.setAttribute("refX", SVG.MARKER.BOUNDS.REF_X);  // relative marker coordinate
        markerEnd.setAttribute("refY", SVG.MARKER.BOUNDS.REF_Y);  // relative marker coordinate
        markerEnd.setAttribute("markerWidth", SVG.MARKER.BOUNDS.WIDTH);
        markerEnd.setAttribute("markerHeight", SVG.MARKER.BOUNDS.HEIGHT);
        markerEnd.setAttribute("viewBox", SVG.MARKER.VIEW_BOX);
        markerEnd.appendChild(trianglePath);

        return markerEnd;
    }

    /**
     * Sharing the algorithm and its output and input with the visualizer such that the algorithm can work with the data.
     * @param algorithm {Object} - Contains an alignment algorithm.
     * @param input {Object} - Contains all input data.
     * @param output {Object} - Contains all output data.
     */
    function shareInformation(algorithm, input, output) {
        visualizerInstance.algorithm = algorithm;
        visualizerInstance.input = input;
        visualizerInstance.output = output;
    }

    /**
     * Shows to which cells a cell can backtrack.
     * @param cellCoordinates {Object} - The vector-position of the cell which have been clicked.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param table {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     */
    function showFlow(cellCoordinates, calculationVerticalTable, table, calculationHorizontalTable) {
        var flows = visualizerInstance.algorithm.getTraces([cellCoordinates], visualizerInstance.input, visualizerInstance.output, 1);

        for (i = 0; i < visualizerInstance.lastFlows.length; i++)
            demarkCells(visualizerInstance.lastFlows[i], calculationVerticalTable, table, calculationHorizontalTable, i, true);

        for (var i = 0; i < flows.length; i++)
            markCells(flows[i].reverse(), calculationVerticalTable, table, calculationHorizontalTable, i, true, true);

        visualizerInstance.lastFlows = flows;
    }

    /**
     * Turns off cell highlights.
     * @param path {Array} - Array containing the first vector element from which on you want find a path.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param table {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     * @param colorClass {number} - The highlight which should be deleted from the cell.
     * @param flowMode {boolean} - Tells if flows or traceback-paths were drawn.
     */
    function demarkCells(path, calculationVerticalTable, table, calculationHorizontalTable, colorClass, flowMode) {
        flowMode = flowMode || false;

        var currentTable;

        // go over the whole path
        if (path.length > 0) {
            for (var j = 0; j < path.length; j++) {
                currentTable = getRightTable(path, j, calculationVerticalTable, table, calculationHorizontalTable);

                var posI = path[j].i + 1;
                var posJ = path[j].j + 1;

                if (currentTable.rows[posI].cells[posJ] !== undefined) {  // if table has shrinked

                    switch (colorClass) {
                        case -1:
                            currentTable.rows[posI].cells[posJ].classList.remove("selected");
                            break;
                        default:
                            removeColors(currentTable, posI, posJ);
                    }
                }

                removeArrow(currentTable, posI, posJ);
            }
        }

        removeAllLines();  // below last flows/paths redrawn

        if (flowMode)  // redraw last traceback
            markCells(visualizerInstance.lastPath, calculationVerticalTable, table, calculationHorizontalTable, -1, true, false);
        else {  // redraw last flow
            var lastFlows = visualizerInstance.lastFlows;
            for (var i = 0; i < lastFlows.length; i++)
                markCells(lastFlows[i], calculationVerticalTable, table, calculationHorizontalTable, i, true, true);
        }
    }

    /**
     * Returns the table of the path element on which is currently looked at.
     * @param path {Array} - Array containing the first vector element from which on you want find a path.
     * @param j {number} - Current path element from which the table must be determined.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param table {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     * @return {Element} - Default table or table for vertical or horizontal gap costs are returned.
     */
    function getRightTable(path, j, calculationVerticalTable, table, calculationHorizontalTable) {
        if (path[j].label === MATRICES.VERTICAL)
            return calculationVerticalTable;
        else if (path[j].label === MATRICES.DEFAULT)
            return table;
        // else if (path[j].label === MATRICES.HORIZONTAL)
        return calculationHorizontalTable;
    }

    /**
     * Removes highlights at a specific position in the table.
     * @param table {Element} - The table from which colors have to be removed.
     * @param posI {number} - The first coordinate.
     * @param posJ {number} - The second coordinate.
     */
    function removeColors(table, posI, posJ) {
        table.rows[posI].cells[posJ].classList.remove("selected_light_red");
        table.rows[posI].cells[posJ].classList.remove("selected_very_light_red");
        table.rows[posI].cells[posJ].classList.remove("selected_red");
        table.rows[posI].cells[posJ].classList.remove("selected_green");
    }

    /**
     * Removes short sprite sheet arrows at a specific position in the table.
     * @param table {Element} - The table from which arrows have to be removed.
     * @param posI {number} - The first coordinate.
     * @param posJ {number} - The second coordinate.
     */
    function removeArrow(table, posI, posJ) {
        var cell = table.rows[posI].cells[posJ];
        var numChildren = cell.children.length;

        for (var k = 0; k < numChildren; k++)
            cell.children[0].outerHTML = SYMBOLS.EMPTY;
    }

    /**
     * Removes long SVG arrows in the table.
     */
    function removeAllLines() {
        var line;
        while ((line = visualizerInstance.cellLines.pop()) !== undefined) {
            if (visualizerInstance.svg.contains(line))
                visualizerInstance.svg.removeChild(line);
        }
    }

    /**
     * Turns on cell highlights.
     * @param path {Array} - Array containing the first vector element from which on you want find a path.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param table {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     * @param colorClass {number} - The highlight which should be added to a cell.
     * @param arrows {boolean} - Tells if arrows should be drawn or not.
     * @param flowMode {boolean} - Tells if flows or traceback-paths are drawn.
     */
    function markCells(path, calculationVerticalTable, table, calculationHorizontalTable, colorClass, arrows, flowMode) {
        arrows = arrows || false;

        var lastPosI;
        var lastPosJ;
        var lastTable;

        var currentTable;

        for (var j = 0; j < path.length; j++) {
            currentTable = getRightTable(path, j, calculationVerticalTable, table, calculationHorizontalTable);

            var posI = path[j].i + 1;
            var posJ = path[j].j + 1;

            switch (colorClass) {
                case 0:
                    currentTable.rows[posI].cells[posJ].classList.add("selected_light_red");
                    break;
                case 1:
                    currentTable.rows[posI].cells[posJ].classList.add("selected_very_light_red");
                    break;
                case 2:
                    currentTable.rows[posI].cells[posJ].classList.add("selected_red");
                    break;
                default:
                    currentTable.rows[posI].cells[posJ].classList.add("selected");
            }

            if (j === path.length - 1 && colorClass !== -1) {
                removeColors(currentTable, posI, posJ);
                currentTable.rows[posI].cells[posJ].classList.add("selected_green");
            }

            if (arrows) {
                placeArrow(currentTable, posI, posJ, lastTable, lastPosI, lastPosJ, flowMode);
                lastPosI = posI;
                lastPosJ = posJ;
                lastTable = currentTable;
            }
        }
    }

    /**
     * Allows to draw short an long arrows on top of two tables.
     * @param table {Element} - The current table which is visited.
     * @param posI {number} - The first coordinate.
     * @param posJ {number} - The second coordinate.
     * @param lastTable {Element} - The table that was visited before.
     * @param lastPosI {number} - The last first coordinate.
     * @param lastPosJ {number} - The last second coordinate.
     * @param flowMode {boolean} - Tells if flows or traceback-paths are drawn.
     */
    function placeArrow(table, posI, posJ, lastTable, lastPosI, lastPosJ, flowMode) {
        // function is executed only if one step in the table has already been done
        if (lastPosI !== undefined && lastPosI !== undefined) {
            var cell = table.rows[posI].cells[posJ];
            var lastCell = lastTable.rows[lastPosI].cells[lastPosJ];

            // drawings within the same table
            if (lastTable === table) {
                // case determination
                var isTop = posI - lastPosI === 1;
                var isLeft = posJ - lastPosJ === 1;
                var isVertical = posI - lastPosI > 1;
                var isHorizontal = posJ - lastPosJ > 1;

                // draw case
                if (isTop && isLeft) {
                    if ($(cell).find(ARROWS.DIAGONAL_NAME).length !== 1)
                        $(cell).append(ARROWS.DIAGONAL);
                }
                else if (isLeft) {
                    if ($(cell).find(ARROWS.LEFT_NAME).length !== 1)
                        $(cell).append(ARROWS.LEFT);
                }
                else if (isTop) {
                    if ($(cell).find(ARROWS.TOP_NAME).length !== 1)
                        $(cell).append(ARROWS.TOP);
                } else if (isVertical) {
                    drawLine(cell, lastCell, MOVE.VERTICAL, flowMode);
                } else if (isHorizontal) {
                    drawLine(cell, lastCell, MOVE.HORIZONTAL, flowMode);
                }
            } else if (lastTable !== table) {  // drawings between two different tables
                var parentMatrix = getParentMatrix(cell);
                var lastParentMatrix = getParentMatrix(lastCell);

                // case determination
                var isPtoX = parentMatrix === MATRICES.VERTICAL && lastParentMatrix === MATRICES.DEFAULT;
                var isQtoX = parentMatrix === MATRICES.HORIZONTAL && lastParentMatrix === MATRICES.DEFAULT;
                var isXtoP = parentMatrix === MATRICES.DEFAULT && lastParentMatrix === MATRICES.VERTICAL;
                var isXtoQ = parentMatrix === MATRICES.DEFAULT && lastParentMatrix === MATRICES.HORIZONTAL;

                // draw case
                if (isPtoX)
                    drawLine(cell, lastCell, MOVE.P_TO_X, flowMode);
                else if (isQtoX)
                    drawLine(cell, lastCell, MOVE.Q_TO_X, flowMode);
                else if (isXtoP)
                    drawLine(cell, lastCell, MOVE.X_TO_P, flowMode);
                else if (isXtoQ)
                    drawLine(cell, lastCell, MOVE.X_TO_Q, flowMode);
            }
        }
    }

    /**
     * Returns the matrix identifier of a cell.
     * @param cell {Element} - The cell from which the matrix is determined.
     * @return {string} - The identifier of the matrix cell.
     */
    function getParentMatrix(cell) {
        if (cell.parentNode.parentNode.parentNode.id === "calculation_horizontal")
            return MATRICES.HORIZONTAL;
        else if (cell.parentNode.parentNode.parentNode.id === "calculation_vertical")
            return MATRICES.VERTICAL;
        else if (cell.parentNode.parentNode.parentNode.id === "calculation")
            return MATRICES.DEFAULT;
    }

    /**
     * Drawing a line from cell to the last cell. Hint: The visiting of cells is starting in the top left.
     * @param cell {Element} - The current cell which is visited.
     * @param lastCell {Element} - The cell that was visited before.
     * @param move {string} - The type of MOVE {P_TO_X, Q_TO_X, ...}.
     * @param flowMode {boolean} - Tells if flows or traceback-paths are drawn.
     */
    function drawLine(cell, lastCell, move, flowMode) {
        debugger;
        var cellHeight = cell.offsetHeight;  //
        var cellWidth = cell.offsetWidth;

        var left;
        var top;
        var lastLeft;
        var lastTop;

        // with different moves, the long arrow has to be drawn different
        if (move === MOVE.HORIZONTAL) {
            left        =   (cell.offsetLeft        + cellWidth     * CELL_PERCENT.LINE).toString();
            top         =   (cell.offsetTop         + cellHeight    * CELL_PERCENT.LINE).toString();
            lastLeft    =   (lastCell.offsetLeft    + cellWidth     * (1-CELL_PERCENT.LINE_HEAD_PENETRATION)).toString();
            lastTop     =   (lastCell.offsetTop     + cellHeight    * CELL_PERCENT.LINE).toString();
        } else if (move === MOVE.P_TO_X) {
            left        =   (cell.offsetLeft        + cellWidth     * (1-CELL_PERCENT.LINE)).toString();
            top         =   (cell.offsetTop         + cellHeight    * (1-CELL_PERCENT.LINE)).toString();
            lastLeft    =   (lastCell.offsetLeft    + cellWidth     * (1-CELL_PERCENT.LINE)).toString();
            lastTop     =   (lastCell.offsetTop     + cellHeight    * CELL_PERCENT.LINE).toString();
        } else if (move === MOVE.Q_TO_X) {
            left        =   (cell.offsetLeft        + cellWidth     * CELL_PERCENT.LINE).toString();
            top         =   (cell.offsetTop         + cellHeight    * CELL_PERCENT.LINE).toString();
            lastLeft    =   (lastCell.offsetLeft    + cellWidth     * (1-CELL_PERCENT.LINE)).toString();
            lastTop     =   (lastCell.offsetTop     + cellHeight    * (1-CELL_PERCENT.LINE)).toString();
        } else if (move === MOVE.VERTICAL) {
            left        =   (cell.offsetLeft        + cellWidth     * CELL_PERCENT.LINE).toString();
            top         =   (cell.offsetTop         + cellHeight    * CELL_PERCENT.LINE).toString();
            lastLeft    =   (lastCell.offsetLeft    + cellWidth     * CELL_PERCENT.LINE).toString();
            lastTop     =   (lastCell.offsetTop     + cellHeight    * (1-CELL_PERCENT.LINE_HEAD_PENETRATION)).toString();
        } else if (move === MOVE.X_TO_P) {
            left        =   (cell.offsetLeft        + cellWidth     * CELL_PERCENT.LINE).toString();
            top         =   (cell.offsetTop         + cellHeight    * CELL_PERCENT.LINE).toString();
            lastLeft    =   (lastCell.offsetLeft    + cellWidth     * CELL_PERCENT.LINE).toString();
            lastTop     =   (lastCell.offsetTop     + cellHeight    * (1 - CELL_PERCENT.LINE)).toString();
        } else if (move === MOVE.X_TO_Q) {
            left        =   (cell.offsetLeft        + cellWidth     * CELL_PERCENT.LINE).toString();
            top         =   (cell.offsetTop         + cellHeight    * (1-CELL_PERCENT.LINE)).toString();
            lastLeft    =   (lastCell.offsetLeft    + cellWidth     * CELL_PERCENT.LINE).toString();
            lastTop     =   (lastCell.offsetTop     + cellHeight    * CELL_PERCENT.LINE).toString();
        }

        // define svg dimensions
        visualizerInstance.svg.setAttribute("width", document.body.offsetWidth);
        visualizerInstance.svg.setAttribute("height", document.body.offsetHeight);

        // create line with previously defined marker
        var line = document.createElementNS(SVG.NAME_SPACE, "line");

        if (flowMode) {  // differentiate between drawing flows and tracebacks
            line.setAttribute("marker-end", SVG.MARKER.URL_FLOW);
            line.setAttribute("stroke", SVG.FLOW_LONG_ARROW_COLOR);
        }
        else {
            line.setAttribute("marker-end", SVG.MARKER.URL_TRACEBACK);
            line.setAttribute("stroke", SVG.TRACEBACK_LONG_ARROW_COLOR);
        }
        line.setAttribute("x1", left);
        line.setAttribute("y1", top);
        line.setAttribute("x2", lastLeft);
        line.setAttribute("y2", lastTop);
        line.setAttribute("stroke-dasharray", SVG.STROKE_DASHARRAY);
        visualizerInstance.svg.appendChild(line);
        visualizerInstance.cellLines.push(line);

        // creating an SVG overlay if there is not already one
        if (visualizerInstance.container.childElementCount !== 1)
            visualizerInstance.container.appendChild(visualizerInstance.svg);
    }

    /**
     * Highlights tracebacks in the matrix.
     * @param traceNumber {number} - The current path which should be drawn.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param calculationTable {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     */
    function showTraceback(traceNumber, calculationVerticalTable, calculationTable, calculationHorizontalTable) {
        var path = visualizerInstance.output.tracebackPaths[traceNumber];

        // check if you want maybe disable "unhighlight" last drawn path
        if (visualizerInstance.lastPath.length > 0) {
            var posI = visualizerInstance.lastPath[0].i + 1;
            var posJ = visualizerInstance.lastPath[0].j + 1;
            var tableCell = calculationTable.rows[posI].cells[posJ];

            // check if you want disable "unhighlight" last drawn path (example: clicked second time on same path in results table)
            if (path === visualizerInstance.lastPath
                && tableCell !== undefined
                && tableCell.classList.contains("selected")) {  // case: same path
                demarkCells(visualizerInstance.lastPath, calculationVerticalTable, calculationTable, calculationHorizontalTable, -1, false);
                visualizerInstance.lastPath = [];
            } else {  // case: different path (click on a new path)
                demarkCells(visualizerInstance.lastPath, calculationVerticalTable, calculationTable, calculationHorizontalTable, -1, false);
                markCells(path, calculationVerticalTable, calculationTable, calculationHorizontalTable, -1, true, false);
                visualizerInstance.lastPath = path;
            }
        } else {  // case: first time selected
            markCells(path, calculationVerticalTable, calculationTable, calculationHorizontalTable, -1, true, false);
            visualizerInstance.lastPath = path;
        }
    }

    /**
     * Highlights a selected entry for example in the results table.
     * @param rowNumber {number} - The row number of the row which was clicked.
     * @param table {Element} - The default or main table.
     */
    function highlight(rowNumber, table) {
        var start = 0;  // the row number in which highlighting starts

        // determining cells
        var cell = table.rows[rowNumber + start].cells[0];
        var lastCell = visualizerInstance.lastRowNumber >= 0
            ? table.rows[visualizerInstance.lastRowNumber + start].cells[0] : undefined;

        // check if the row has to be selected or deselected
        if (rowNumber === visualizerInstance.lastRowNumber
            && lastCell.classList.contains("selected")) {  // case: same cell (clicked second time) -> deselect
            lastCell.classList.remove("selected");
        } else if (lastCell !== undefined) {  // case: different cell -> deselect last cell and select current cell
            lastCell.classList.remove("selected");
            cell.classList.add("selected");
        } else {  // case: first time clicked in table -> select current cell
            cell.classList.add("selected");
        }

        visualizerInstance.lastRowNumber = rowNumber;
    }

    /**
     * Allows downloading a table.
     * Hint: " e.data.number" allows to distinguish between the different tables of an algorithm.
     * @param e - Stores data relevant to the event called that function.
     */
    function downloadTable(e) {
        var number = e.data.number;

        var matrix = getMatrix(number);
        var upperString = visualizerInstance.input.sequenceA;
        var leftString = visualizerInstance.input.sequenceB;

        var tableCSV = tableToCSV(number, matrix, upperString, leftString);
        var tableFile = new File([tableCSV], {type: TABLE.TEXT_FILE_ENCODING});

        saveAs(tableFile, TABLE.DOWNLOAD_NAME);
    }

    /**
     * Allows to select a matrix by number identifier.
     * @param number - Table number, allows to select a table {DEFAULT, HORIZONTAL, VERTICAL}.
     * @return {matrix} - The appropriate matrix to the number which was passed.
     */
    function getMatrix(number) {
        switch (number) {
            case MATRICES.VERTICAL_NUMBER:
                return replaceInfinities(visualizerInstance.output.verticalGaps);
            case MATRICES.HORIZONTAL_NUMBER:
                return replaceInfinities(visualizerInstance.output.horizontalGaps);
        }

        return visualizerInstance.output.matrix;
    }

    /**
     * Replaces LaTeX-infinity-symbols with infinity-values.
     * @param matrix {matrix} - The matrix in which you want replace LaTeX-infinity-symbols with infinity-values.
     * @return {matrix} - The appropriate matrix to the number which was passed.
     */
    function replaceInfinities(matrix) {
        for (var i = 0; i < matrix.length; i++) {
            for (var j = 0; j < matrix[0].length; j++) {
                if (matrix[i][j] === LATEX.NEGATIVE_INFINITY)
                    matrix[i][j] = SYMBOLS.INFINITY;
                else if (matrix[i][j] === LATEX.POSITIVE_INFINITY)
                    matrix[i][j] = SYMBOLS.NEGATIVE_INFINITY;
            }
        }

        return matrix;
    }

    /**
     * Computes the string which is stored in a table download-file.
     * @param number - The type of matrix {0: MATRICES.VERTICAL, 1: MATRICES.DEFAULT, 2: MATRICES.HORIZONTAL}.
     * @param matrix - The matrix from which you get the values.
     * @param upperString - The string of the first input sequence.
     * @param leftString {string} - The string of the second input sequence.
     * @return {string} - CSV formatted data.
     * @see CSV specification: https://www.ietf.org/rfc/rfc4180.txt
     */
    function tableToCSV(number, matrix, upperString, leftString) {
        var string = SYMBOLS.EMPTY;

        // differentiate between the type of matrices you can download and add a symbol for the matrix type to the string
        switch (number) {
            case 0:
                string += MATRICES.VERTICAL + SYMBOLS.COMMA;
                break;
            case 1:
                string += MATRICES.DEFAULT + SYMBOLS.COMMA;
                break;
            case 2:
                string += MATRICES.HORIZONTAL + SYMBOLS.COMMA;
                break;
        }
        string += SYMBOLS.COMMA + upperString.split(SYMBOLS.EMPTY).toString() + SYMBOLS.NEW_LINE;

        // compute CSV
        for (var i = 0; i < matrix.length; i++) {
            if (i === 0)
                string += SYMBOLS.COMMA;
            else
                string += leftString.charAt(i-1) + SYMBOLS.COMMA;

            string += matrix[i] + SYMBOLS.NEW_LINE;  // Hint: it is allowed to have a line break in the last line
        }

        return string;
    }

    /**
     * Post edits a matrix and replaces infinity-values with LaTeX-infinity-symbols.
     * @param matrix - The matrix in which you want replace infinity-values with LaTeX-symbols.
     * @return {Array} - The matrix in which symbols where replaced with LaTeX-symbols.
     */
    function replaceInfinityStrings(matrix) {
        for (var i = 0; i < matrix.length; i++) {
            for (var j = 0; j < matrix[0].length; j++) {
                if (matrix[i][j] === Number.POSITIVE_INFINITY)
                    matrix[i][j] = LATEX.POSITIVE_INFINITY;
                else if (matrix[i][j] === Number.NEGATIVE_INFINITY)
                    matrix[i][j] = LATEX.NEGATIVE_INFINITY;
            }
        }

        return matrix;
    }

    /**
     * Redraw overlay after a resize-event of the browser window.
     * @param e - Stores data relevant to the event called that function.
     */
    function redrawOverlay(e) {
        var calculationVerticalTable;
        var calculation = e.data.calculationTable[0];
        var calculationHorizontalTable;

        if (e.data.calculationVerticalTable !== undefined) {
            calculationVerticalTable = e.data.calculationVerticalTable[0];
            calculationHorizontalTable = e.data.calculationHorizontalTable[0];
        }

        removeAllLines();
        drawAllLines(calculationVerticalTable, calculation, calculationHorizontalTable);
    }

    /**
     * Draw all lines which were previously drawn.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param table {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     */
    function drawAllLines(calculationVerticalTable, table, calculationHorizontalTable) {
        drawArrowLines(visualizerInstance.lastPath, calculationVerticalTable, table, calculationHorizontalTable, false);

        var lastFlows = visualizerInstance.lastFlows;
        for (var i = 0; i < lastFlows.length; i++)
            drawArrowLines(lastFlows[i], calculationVerticalTable, table, calculationHorizontalTable, true);
    }

    /**
     * Redrawing arrow lines.
     * @param path {Array} - Array containing the first vector element from which on you want find a path.
     * @param calculationVerticalTable {Element} - The table storing the vertical gap costs.
     * @param table {Element} - The default or main table.
     * @param calculationHorizontalTable {Element} - The table storing the horizontal gap costs.
     * @param flowMode {boolean} - Tells if flows or traceback-paths are drawn.
     */
    function drawArrowLines(path, calculationVerticalTable, table, calculationHorizontalTable, flowMode) {
        var lastPosI;
        var lastPosJ;
        var lastTable;

        var currentTable;

        for (var j = 0; j < path.length; j++) {
            currentTable = getRightTable(path, j, calculationVerticalTable, table, calculationHorizontalTable);

            var posI = path[j].i + 1;
            var posJ = path[j].j + 1;

            placeArrow(currentTable, posI, posJ, lastTable, lastPosI, lastPosJ, flowMode);
            lastPosI = posI;
            lastPosJ = posJ;
            lastTable = currentTable;
        }
    }

    /**
     * Removes all contents stored in the visualizer
     * for example after the algorithm is changed
     * or before a recomputation is done.
     */
    function removeAllContents() {
        removeAllLines();

        visualizerInstance.algorithm = {};

        visualizerInstance.cellLines = [];

        visualizerInstance.lastFlows = [];
        visualizerInstance.lastPath = [];
        visualizerInstance.lastRowNumber = -1;

        visualizerInstance.input = {};
        visualizerInstance.output = {};
    }
}());