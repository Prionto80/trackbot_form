/**
 * =========================================================================
 * EWURC - Trackbot 1.0 Recruitment Form - Google Apps Script Webhook
 * =========================================================================
 * 
 * Target Google Sheet Columns (Row 1 headers):
 * 1. Timestamp
 * 2. Full Name
 * 3. Student Id
 * 4. Mail Address (Personal)
 * 5. Contact Number
 * 6. Previous Experience on Robotics
 * 7. Send Money to: 01847128593 (Use YourName_Trackbot in bKash reference).
 *    Attach the transaction ID:
 * 8. Payment Proof (Screenshot)
 * 
 * INSTRUCTIONS TO UPDATE IN APPS SCRIPT:
 * 1. Open your Google Form in your browser.
 * 2. Click the three dots (More) -> Select "Script editor" (Apps Script).
 * 3. Replace the entire code in Code.gs with THIS FILE.
 * 4. Click the blue "Deploy" button (top right) -> "Manage deployments".
 * 5. Click the pencil (edit) icon on your existing deployment.
 * 6. Under "Version", select "New version" (CRITICAL: Do not skip this step!).
 * 7. Click "Deploy".
 * =========================================================================
 */

var DRIVE_FOLDER_NAME = "EWURC_Trackbot_Payment_Proofs";

/**
 * Handle incoming POST requests from FastAPI backend
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return createJsonResponse({ success: false, message: "Server busy, please retry." });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, message: "No data payload received." });
    }

    var data = JSON.parse(e.postData.contents);
    var fullName = (data.full_name || data.name || "").trim();
    var studentId = (data.student_id || data.id || "").trim();
    var email = (data.email || data.mail || "").trim();
    var contactNumber = (data.contact_number || data.phone || "").trim();
    var experience = (data.experience || "").trim();
    var transactionId = (data.transaction_id || data.trx || "").trim();

    var driveFileUrl = "No screenshot uploaded";

    // 1. Process and save uploaded screenshot to Google Drive
    if (data.screenshot_base64) {
      try {
        var folder = getOrCreateFolder(DRIVE_FOLDER_NAME);
        var decodedBytes = Utilities.base64Decode(data.screenshot_base64);
        var filename = data.screenshot_filename || ("proof_" + studentId + "_" + new Date().getTime() + ".png");
        var mimeType = data.screenshot_mimetype || "image/png";

        var blob = Utilities.newBlob(decodedBytes, mimeType, filename);
        var file = folder.createFile(blob);
        
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        driveFileUrl = file.getUrl();
      } catch (fileErr) {
        Logger.log("Error saving screenshot to Drive: " + fileErr);
        driveFileUrl = "Error saving file: " + fileErr.toString();
      }
    }

    // 2. Record response directly to the Google Sheet by matching Row 1 Headers
    var sheetRecorded = false;
    var sheet = getTargetSheet();

    if (sheet) {
      var lastCol = sheet.getLastColumn();
      var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      var row = [];

      if (headers.length === 0) {
        headers = [
          "Timestamp",
          "Full Name",
          "Student Id",
          "Mail Address (Personal)",
          "Contact Number",
          "Previous Experience on Robotics",
          "Send Money to: 01847128593 (Attach the transaction ID)",
          "Payment Proof (Screenshot)"
        ];
        sheet.appendRow(headers);
        sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#5b21b6").setFontColor("#ffffff");
      }

      // Map each column dynamically by inspecting its header text in Row 1
      for (var i = 0; i < headers.length; i++) {
        var h = (headers[i] || "").toString().toLowerCase().replace(/\s+/g, " ").trim();

        if (h.indexOf("timestamp") !== -1) {
          row.push(new Date());
        } else if (h.indexOf("full name") !== -1 || h === "name") {
          row.push(fullName);
        } else if ((h.indexOf("student") !== -1 || h.indexOf("id") !== -1) && h.indexOf("trans") === -1 && h.indexOf("trx") === -1 && h.indexOf("01847") === -1) {
          row.push(studentId);
        } else if (h.indexOf("mail") !== -1 || h.indexOf("email") !== -1) {
          row.push(email);
        } else if (h.indexOf("contact") !== -1 || h.indexOf("phone") !== -1 || h.indexOf("number") !== -1) {
          row.push(contactNumber);
        } else if (h.indexOf("experience") !== -1 || h.indexOf("robotics") !== -1) {
          row.push(experience);
        } else if (h.indexOf("01847") !== -1 || h.indexOf("trans") !== -1 || h.indexOf("trx") !== -1 || h.indexOf("send money") !== -1 || h.indexOf("attach") !== -1) {
          row.push(transactionId);
        } else if (h.indexOf("proof") !== -1 || h.indexOf("screenshot") !== -1 || h.indexOf("payment") !== -1 || h.indexOf("file") !== -1) {
          row.push(driveFileUrl);
        } else {
          row.push("");
        }
      }

      sheet.appendRow(row);
      sheetRecorded = true;
    }

    return createJsonResponse({
      success: true,
      message: "Submission processed successfully!",
      drive_file_url: driveFileUrl,
      sheet_recorded: sheetRecorded
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      message: "Error processing submission: " + error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Handle GET request for status health check
 */
function doGet(e) {
  return createJsonResponse({
    status: "online",
    service: "EWURC Trackbot 1.0 Recruitment Webhook",
    timestamp: new Date().toISOString()
  });
}

/**
 * Helper to get target response Google Sheet
 */
function getTargetSheet() {
  var ss = null;

  // 1. Try finding linked spreadsheet from active Google Form
  try {
    var form = FormApp.getActiveForm();
    if (form) {
      var destId = form.getDestinationId();
      if (destId) {
        ss = SpreadsheetApp.openById(destId);
      }
    }
  } catch (e) {}

  // 2. Try active spreadsheet (if script is inside the Sheet)
  if (!ss) {
    try {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    } catch (e) {}
  }

  if (ss) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName().toLowerCase();
      if (name.indexOf("response") !== -1 || name.indexOf("form") !== -1) {
        return sheets[i];
      }
    }
    return sheets[0];
  }

  return null;
}

/**
 * Helper to find or create Google Drive folder
 */
function getOrCreateFolder(folderName) {
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Helper to generate JSON response
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Test function to verify with 1 click
 */
function testManual() {
  var sample = {
    postData: {
      contents: JSON.stringify({
        full_name: "Mahmudul Hasan",
        student_id: "2025-1-60-299",
        email: "neatpixel@gmail.com",
        contact_number: "01712345678",
        experience: "Yes",
        transaction_id: "TRX_VERIFY_999",
        screenshot_filename: "test.png",
        screenshot_mimetype: "image/png",
        screenshot_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      })
    }
  };

  var res = doPost(sample);
  Logger.log(res.getContent());
}
