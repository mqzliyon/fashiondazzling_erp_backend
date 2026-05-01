const PDFDocument = require("pdfkit");
const FabricLot = require("../models/FabricLot");
const MovementLog = require("../models/MovementLog");
const CuttingBatch = require("../models/CuttingBatch");
const CuttingConversion = require("../models/CuttingConversion");
const RejectManagement = require("../models/RejectManagement");
const OfficeDispatch = require("../models/OfficeDispatch");
const ForeignShipment = require("../models/ForeignShipment");
const asyncHandler = require("../utils/asyncHandler");

function streamPdf(res, fileName, title, renderContent) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  doc.pipe(res);

  doc.fontSize(18).text(title);
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor("#6b7280").text(`Generated: ${new Date().toLocaleString()}`);
  doc.fillColor("#111827");
  doc.moveDown();

  renderContent(doc);

  doc.end();
}

function printRows(doc, rows) {
  rows.forEach((row) => {
    if (doc.y > 760) {
      doc.addPage();
    }
    doc.fontSize(10).text(row);
  });
}

const downloadFabricStockReport = asyncHandler(async (req, res) => {
  const lots = await FabricLot.find({}).sort({ fabricType: 1, createdAt: 1 });

  streamPdf(res, "fabric-stock-report.pdf", "Fabric Stock Report", (doc) => {
    if (!lots.length) {
      doc.fontSize(11).text("No fabric lot records found.");
      return;
    }

    const totalAvailableKg = lots.reduce((sum, lot) => sum + lot.availableKg, 0);
    doc.fontSize(11).text(`Total Item: ${lots.length}`);
    doc.text(`Total Available Stock: ${totalAvailableKg.toFixed(2)} kg`);
    doc.moveDown();

    printRows(
      doc,
      lots.map(
        (lot) =>
          `Fabric: ${lot.fabricType} | Input: ${lot.quantityKg.toFixed(2)} kg | Available: ${lot.availableKg.toFixed(2)} kg | Status: ${lot.status} | Ref: ${lot._id}`
      )
    );
  });
});

const downloadLotHistoryReport = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.lotId) {
    query.lot = req.query.lotId;
  }

  const history = await MovementLog.find(query).populate("lot").sort({ date: -1, createdAt: -1 });

  streamPdf(res, "lot-history-report.pdf", "Lot History Report", (doc) => {
    if (!history.length) {
      doc.fontSize(11).text("No lot movement history found.");
      return;
    }

    printRows(
      doc,
      history.map(
        (item) =>
          `${new Date(item.date).toLocaleString()} | Lot: ${item.lot?.lotNumber || "N/A"} | ${item.fromStage} -> ${item.toStage} | Qty: ${item.quantity} ${item.unit} | User: ${item.user}`
      )
    );
  });
});

const downloadCuttingReport = asyncHandler(async (req, res) => {
  const [batches, conversions] = await Promise.all([
    CuttingBatch.find({}).sort({ batchDate: -1 }).limit(100),
    CuttingConversion.find({}).populate("lot").sort({ date: -1 }).limit(100),
  ]);

  streamPdf(res, "cutting-report.pdf", "Cutting Report", (doc) => {
    doc.fontSize(12).text("Cutting Batches");
    doc.moveDown(0.3);
    if (!batches.length) {
      doc.fontSize(10).text("No cutting batches found.");
    } else {
      printRows(
        doc,
        batches.map(
          (batch) =>
            `${new Date(batch.batchDate).toLocaleString()} | Fabric: ${batch.fabricType} | Qty: ${batch.quantityKg.toFixed(2)} kg | Operator: ${batch.operatorName || "N/A"}`
        )
      );
    }

    doc.moveDown();
    doc.fontSize(12).text("Cutting Conversions");
    doc.moveDown(0.3);
    if (!conversions.length) {
      doc.fontSize(10).text("No cutting conversions found.");
    } else {
      printRows(
        doc,
        conversions.map(
          (item) =>
            `${new Date(item.date).toLocaleString()} | Lot: ${item.lot?.lotNumber || "N/A"} | Input: ${item.inputKg.toFixed(2)} kg | Output: ${item.outputPieces.toFixed(2)} pcs | Ratio: ${item.conversionRatio}`
        )
      );
    }
  });
});

const downloadRejectReport = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.stage) {
    query.stage = req.query.stage;
  }

  const rejects = await RejectManagement.find(query).populate("lot").sort({ date: -1 }).limit(200);

  streamPdf(res, "reject-report.pdf", "Reject Report", (doc) => {
    if (!rejects.length) {
      doc.fontSize(11).text("No reject records found.");
      return;
    }

    const totalRejectQty = rejects.reduce((sum, item) => sum + item.quantity, 0);
    doc.fontSize(11).text(`Total Reject Entries: ${rejects.length}`);
    doc.text(`Total Reject Quantity: ${totalRejectQty}`);
    doc.moveDown();

    printRows(
      doc,
      rejects.map(
        (item) =>
          `${new Date(item.date).toLocaleString()} | Lot: ${item.lot?.lotNumber || "N/A"} | Stage: ${item.stage} | Qty: ${item.quantity} pcs | Reason: ${item.reason}`
      )
    );
  });
});

const downloadShipmentReport = asyncHandler(async (req, res) => {
  const [officeDispatches, foreignShipments] = await Promise.all([
    OfficeDispatch.find({}).populate("lot").sort({ dispatchDate: -1 }).limit(200),
    ForeignShipment.find({}).populate("lot").sort({ shipmentDate: -1 }).limit(200),
  ]);

  streamPdf(res, "shipment-report.pdf", "Shipment Report", (doc) => {
    doc.fontSize(12).text("Office Dispatches");
    doc.moveDown(0.3);
    if (!officeDispatches.length) {
      doc.fontSize(10).text("No office dispatch records.");
    } else {
      printRows(
        doc,
        officeDispatches.map(
          (item) =>
            `${new Date(item.dispatchDate).toLocaleString()} | Office: ${item.office} | Lot: ${item.lot?.lotNumber || "N/A"} | Qty: ${item.quantity} pcs | Ref: ${item.referenceNo} | Status: ${item.status}`
        )
      );
    }

    doc.moveDown();
    doc.fontSize(12).text("Foreign Shipments");
    doc.moveDown(0.3);
    if (!foreignShipments.length) {
      doc.fontSize(10).text("No foreign shipment records.");
    } else {
      printRows(
        doc,
        foreignShipments.map(
          (item) =>
            `${new Date(item.shipmentDate).toLocaleString()} | Country: ${item.country} | Shipment: ${item.shipmentNumber} | Lot: ${item.lot?.lotNumber || "N/A"} | Qty: ${item.quantity} pcs | Status: ${item.status}`
        )
      );
    }
  });
});

module.exports = {
  downloadFabricStockReport,
  downloadLotHistoryReport,
  downloadCuttingReport,
  downloadRejectReport,
  downloadShipmentReport,
};
