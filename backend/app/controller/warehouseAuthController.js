import Warehouse from "../models/warehouse.js";
import jwt from "jsonwebtoken";
import { handleResponse } from "../utils/helper.js";
import {
    issueWarehouseVerificationOtp,
    verifyWarehouseOtpCode,
    verifyWarehouseVerificationToken,
    issueWarehouseResetOtp,
    verifyWarehouseResetOtpCode,
} from "../services/warehouseVerificationService.js";
import { uploadToCloudinary } from "../services/mediaService.js";

/* ===============================
   Utils
================================ */

const generateToken = (warehouse) =>
    jwt.sign({ id: warehouse._id, role: "warehouse" }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "3650d",
    });

const WAREHOUSE_DOCUMENT_FIELDS = {
    tradeLicense: "Trade License",
    gstCertificate: "GST Certificate",
    idProof: "ID Proof",
};

const REQUIRED_WAREHOUSE_DOCUMENT_FIELDS = Object.keys(WAREHOUSE_DOCUMENT_FIELDS);

const parseDocumentsPayload = (documents) => {
    if (!documents) return {};
    if (typeof documents === "string") {
        try { return JSON.parse(documents); } catch { return {}; }
    }
    if (typeof documents === "object") return documents;
    return {};
};

const isValidUploadedDocumentReference = (value) => {
    const normalized = String(value || "").trim();
    return /^https?:\/\//i.test(normalized);
};

const resolveWarehouseDocuments = (body = {}, parsedDocuments = {}) => {
    const resolved = { ...(parsedDocuments || {}) };
    const directFields = {
        tradeLicense: body.tradeLicenseUrl || body.tradeLicense,
        gstCertificate: body.gstCertificateUrl || body.gstCertificate,
        idProof: body.idProofUrl || body.idProof,
    };
    for (const [field, candidate] of Object.entries(directFields)) {
        const normalized = String(candidate || "").trim();
        if (normalized && /^https?:\/\//i.test(normalized)) {
            resolved[field] = normalized;
        }
    }
    return resolved;
};

const getMissingRequiredWarehouseDocuments = (documents = {}) =>
    REQUIRED_WAREHOUSE_DOCUMENT_FIELDS.filter(
        (fieldName) => !isValidUploadedDocumentReference(documents[fieldName]),
    );

/* ===============================
   WAREHOUSE SIGNUP
================================ */
export const signupWarehouse = async (req, res) => {
    try {
        const {
            name, email, phone, password,
            emailVerificationToken, phoneVerificationToken,
            warehouseName, shopName, category, description,
            address, locality, pincode, city, state,
            documents, lat, lng, radius
        } = req.body || {};

        const resolvedWarehouseName = warehouseName || shopName;

        const documentFiles = req.files || [];
        const uploadedDocs = {};

            const isDev = process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true';
            for (const file of documentFiles) {
                const fieldName = file.fieldname;
                try {
                    if (fieldName && REQUIRED_WAREHOUSE_DOCUMENT_FIELDS.includes(fieldName)) {
                        if (isDev) {
                            uploadedDocs[fieldName] = `https://mock-storage.com/${fieldName}-${Date.now()}.png`;
                        } else {
                            const url = await uploadToCloudinary(file.buffer, "docs", { mimeType: file.mimetype });
                            uploadedDocs[fieldName] = url;
                        }
                    }
                } catch (err) {
                    console.error("Failed to upload document to Cloudinary", err);
                    if (isDev && fieldName) {
                        uploadedDocs[fieldName] = `https://mock-storage.com/${fieldName}-${Date.now()}.png`;
                    }
                }
            }

        const augmentedBody = { ...req.body, ...uploadedDocs };

        const parsedLat = lat !== undefined ? Number(lat) : undefined;
        const parsedLng = lng !== undefined ? Number(lng) : undefined;
        const parsedRadius = radius !== undefined ? Number(radius) : undefined;

        if (!name || !email || !phone || !password || !resolvedWarehouseName) {
            return handleResponse(res, 400, "All fields are required");
        }

        const isDevMode = process.env.NODE_ENV !== 'production' || process.env.USE_MOCK_OTP === 'true';
        if (!isDevMode) {
            verifyWarehouseVerificationToken({ channel: "email", rawValue: email, token: emailVerificationToken });
            verifyWarehouseVerificationToken({ channel: "phone", rawValue: phone, token: phoneVerificationToken });
        }

        if (lat !== undefined && (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
            return handleResponse(res, 400, "Invalid latitude");
        }
        if (lng !== undefined && (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
            return handleResponse(res, 400, "Invalid longitude");
        }
        if (radius !== undefined && (!Number.isFinite(parsedRadius) || parsedRadius < 1 || parsedRadius > 100)) {
            return handleResponse(res, 400, "Radius must be between 1 and 100 km");
        }

        let warehouse = await Warehouse.findOne({ $or: [{ email }, { phone }] });
        if (warehouse) {
            return handleResponse(res, 400, "Warehouse with this email or phone already exists");
        }

        const parsedDocuments = parseDocumentsPayload(documents);
        const warehouseDocuments = resolveWarehouseDocuments(augmentedBody, parsedDocuments);
        const missingRequiredDocuments = getMissingRequiredWarehouseDocuments(warehouseDocuments || {});

        if (missingRequiredDocuments.length > 0) {
            const readableMissing = missingRequiredDocuments
                .map((field) => WAREHOUSE_DOCUMENT_FIELDS[field] || field)
                .join(", ");
            return handleResponse(res, 400, `All required documents must be uploaded: ${readableMissing}`);
        }

        const warehouseData = {
            name, email, phone, password,
            warehouseName: resolvedWarehouseName,
            shopName: resolvedWarehouseName,
            category, description, address, locality, pincode, city, state,
            documents: warehouseDocuments,
            applicationStatus: "approved",
            isVerified: true,
            emailVerified: true,
            phoneVerified: true,
            isActive: true,
        };

        if (parsedLat !== undefined && parsedLng !== undefined) {
            warehouseData.location = { type: "Point", coordinates: [parsedLng, parsedLat] };
        }
        if (parsedRadius !== undefined) {
            warehouseData.serviceRadius = parsedRadius;
        }

        warehouse = await Warehouse.create(warehouseData);

        return handleResponse(res, 201, "Warehouse registered successfully", {
            warehouse,
            applicationStatus: "pending",
            requiresApproval: true,
        });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

export const sendWarehouseSignupOtp = async (req, res) => {
    try {
        const { channel, email, phone, value } = req.body || {};
        const targetValue =
            channel === "email" ? email || value :
            channel === "phone" ? phone || value : value;

        const result = await issueWarehouseVerificationOtp({ channel, rawValue: targetValue, ipAddress: req.ip });
        return handleResponse(res, 200, "OTP sent successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const verifyWarehouseSignupOtp = async (req, res) => {
    try {
        const { channel, email, phone, value, otp } = req.body || {};
        const targetValue =
            channel === "email" ? email || value :
            channel === "phone" ? phone || value : value;

        const result = await verifyWarehouseOtpCode({ channel, rawValue: targetValue, otp, ipAddress: req.ip });
        return handleResponse(res, 200, "OTP verified successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   WAREHOUSE LOGIN
================================ */
export const loginWarehouse = async (req, res) => {
    try {
        const { email, phone, emailOrPhone, password } = req.body;
        const identifier = emailOrPhone || email || phone;

        if (!identifier || !password) {
            return handleResponse(res, 400, "Email/Phone and password are required");
        }

        const query = identifier.includes("@")
            ? { email: identifier.toLowerCase() }
            : { phone: identifier.replace(/\D/g, "") };

        const warehouse = await Warehouse.findOne(query).select("+password");

        if (!warehouse) {
            return handleResponse(res, 404, "Warehouse not found");
        }

        const isMatch = await warehouse.comparePassword(password);
        if (!isMatch) {
            return handleResponse(res, 401, "Invalid credentials");
        }

        const applicationStatus = warehouse.applicationStatus || (warehouse.isVerified ? "approved" : "pending");
        const isApproved =
            warehouse.isVerified === true &&
            warehouse.isActive === true &&
            applicationStatus === "approved";

        if (!isApproved) {
            const approvalMessage =
                applicationStatus === "rejected"
                    ? "Your warehouse application was rejected. Please contact support."
                    : "Your warehouse account is pending admin approval.";

            return handleResponse(res, 403, approvalMessage, {
                applicationStatus,
                isVerified: warehouse.isVerified === true,
                isActive: warehouse.isActive === true,
                rejectionReason: warehouse.rejectionReason || "",
            });
        }

        warehouse.lastLogin = new Date();
        await warehouse.save();

        const token = generateToken(warehouse);

        return handleResponse(res, 200, "Login successful", { token, seller: warehouse });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};

/* ===============================
   WAREHOUSE FORGOT PASSWORD
================================ */

export const sendWarehouseResetOtp = async (req, res) => {
    try {
        const { channel, rawValue } = req.body;
        if (!channel || !rawValue) {
            return handleResponse(res, 400, "Channel and target value are required");
        }
        const ipAddress = req.ip || req.connection.remoteAddress;
        const result = await issueWarehouseResetOtp({ channel, rawValue, ipAddress });
        return handleResponse(res, 200, "Reset OTP sent successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const verifyWarehouseResetOtp = async (req, res) => {
    try {
        const { channel, rawValue, otp } = req.body;
        if (!channel || !rawValue || !otp) {
            return handleResponse(res, 400, "Channel, target, and OTP are required");
        }
        const ipAddress = req.ip || req.connection.remoteAddress;
        const result = await verifyWarehouseResetOtpCode({ channel, rawValue, otp, ipAddress });
        return handleResponse(res, 200, "OTP verified successfully", result);
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

export const resetWarehousePassword = async (req, res) => {
    try {
        const { channel, rawValue, token, newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return handleResponse(res, 400, "Password must be at least 8 characters long");
        }

        verifyWarehouseVerificationToken({ channel, rawValue, token, purpose: "warehouse_reset" });

        const query = channel === "email" ? { email: rawValue.toLowerCase() } : { phone: rawValue };
        const warehouse = await Warehouse.findOne(query);

        if (!warehouse) {
            return handleResponse(res, 404, "Warehouse not found");
        }

        warehouse.password = newPassword;
        await warehouse.save();

        return handleResponse(res, 200, "Password reset successfully");
    } catch (error) {
        return handleResponse(res, error.statusCode || 500, error.message);
    }
};

/* ===============================
   WAREHOUSE CHECK EXISTS
================================ */
export const checkWarehouseExists = async (req, res) => {
    try {
        const { email, phone } = req.body;
        const query = [];
        if (email) query.push({ email: email.toLowerCase() });
        if (phone) query.push({ phone: phone.replace(/\D/g, "") });

        if (query.length === 0) {
            return handleResponse(res, 400, "Email or phone is required");
        }

        const warehouse = await Warehouse.findOne({ $or: query }).select("_id").lean();
        return handleResponse(res, 200, "Check completed", { exists: !!warehouse });
    } catch (error) {
        return handleResponse(res, 500, error.message);
    }
};
