/* ElectroLoad Pro | export.js
 * Excel export and SVG diagram download.
 * Classic script: shares one global scope with the other files, so keep the load order from index.html.
 */

// Export Schedule Data to Excel Spreadsheet
function exportToExcel() {
    const data = fixtures.map(item => {
        const itemWatts = item.qty * item.watts;
        const current = itemCurrent(item);
        const ckt = circuits.find(c => c.id === item.ckt && c.board === item.board);
        const circuitCurrent = ckt ? ckt.current : current;
        const mcb = ckt ? ckt.mcb : null;

        return {
            "Fixture Name": item.name,
            "Board": boardOf(item.board).name,
            "Room": item.room,
            "Circuit": item.ckt,
            "Supply": eSup(item) + "-Phase",
            "Category": item.category,
            "Quantity": item.qty,
            "Unit Watts": item.watts,
            "Total Power (W)": itemWatts,
            "Power Factor": item.pf,
            "Phase": item.phase,
            "Fixture Current (A)": current.toFixed(2),
            "Circuit Design Current (A)": circuitCurrent.toFixed(2),
            "Breaker Sizing": mcb == null ? 'NOT SIZED - REVIEW REQUIRED' : mcb + 'A MCB',
            "Cable Size": ckt && ckt.wire ? ckt.wire.size : 'NOT SIZED - REVIEW REQUIRED',
            "Cable Length (m)": item.distance
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Load Schedule");

    const boardRows = boards.map((b, i) => {
        const st = b.s || { kw: 0, mx: 0, cb: 0 };
        return {
            "Board": b.name, "Area": b.room || '', "Type": b.type, "Fed From": i === 0 ? "Grid" : boardOf(b.par).name,
            "Supply": bSup(b) + "-Phase", "Feed Distance (m)": i === 0 ? "" : b.dist,
            "Load (kW)": +st.kw.toFixed(2), "Max Current (A)": +st.mx.toFixed(1), "Feeder Breaker": st.cb == null ? 'NOT SIZED' : st.cb + "A"
        };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(boardRows), "Boards");
    XLSX.writeFile(workbook, "Electrical_Load_Schedule.xlsx");
}

// SVG SLD File Download
function downloadSldSvg() {
    const svgData = document.getElementById("sldSvg").outerHTML;
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Single_Line_Diagram_SLD.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
