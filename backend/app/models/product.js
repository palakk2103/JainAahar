import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        sku: {
            type: String,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        salePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        stock: {
            type: Number,
            required: true,
            default: 0,
        },
        lowStockAlert: {
            type: Number,
            default: 5,
        },
        brand: {
            type: String,
            trim: true,
        },
        weight: {
            type: String,
            trim: true,
        },
        tags: [{
            type: String,
            trim: true,
        }],
        highlights: [{
            icon: { type: String, trim: true },
            label: { type: String, trim: true },
        }],
        mainImage: {
            type: String, // Cloudinary URL
        },
        galleryImages: [{
            type: String, // Array of Cloudinary URLs
        }],
        headerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        subcategoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: false,
            default: null,
        },
        /**
         * Legacy seller reference. Optional in single-vendor model where
         * Admin is the sole seller. Existing products with sellerId
         * continue working; new admin-owned products leave this null.
         */
        sellerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Seller",
            default: null,
        },
        /**
         * @deprecated Warehouse association is now handled via WarehouseInventory
         * (per-warehouse, per-product records). This field is kept for backward
         * compatibility with monthly-kit products but should NOT be used to
         * determine which warehouse stocks a product.
         */
        warehouseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Warehouse",
            default: null,
        },
        isMonthlyKit: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active",
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "approved",
        },
        approvalRequestedAt: {
            type: Date,
            default: null,
        },
        approvalReviewedAt: {
            type: Date,
            default: null,
        },
        approvalReviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            default: null,
        },
        approvalNote: {
            type: String,
            trim: true,
            default: "",
        },
        lastSubmittedByRole: {
            type: String,
            enum: ["seller", "admin", "warehouse"],
            default: null,
        },
        variants: [
            {
                name: String,
                price: Number,
                salePrice: Number,
                stock: Number,
                sku: String,
            }
        ],
        isFeatured: {
            type: Boolean,
            default: false,
        },
        /** Shipping weight in kg (e.g. 0.5 = 500g). Used for Shiprocket rate calculation. */
        shippingWeight: {
            type: Number,
            default: null,
            min: 0,
        },
        /** Shipping length in cm. Used for Shiprocket rate calculation. */
        shippingLength: {
            type: Number,
            default: null,
            min: 0,
        },
        /** Shipping breadth/width in cm. Used for Shiprocket rate calculation. */
        shippingBreadth: {
            type: Number,
            default: null,
            min: 0,
        },
        /** Shipping height in cm. Used for Shiprocket rate calculation. */
        shippingHeight: {
            type: Number,
            default: null,
            min: 0,
        },
    },
    { timestamps: true }
);

// Optimize performance for common queries on home/search pages
productSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
productSchema.index({ status: 1, createdAt: -1, _id: -1 });
productSchema.index({ approvalStatus: 1, status: 1, createdAt: -1 });
productSchema.index({ headerId: 1, status: 1 });
productSchema.index({ categoryId: 1, status: 1 });
productSchema.index({ subcategoryId: 1, status: 1 });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ sellerId: 1, approvalStatus: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, createdAt: -1, _id: -1 });
productSchema.index({ name: "text", tags: "text" }); // For better search if regex is too slow

export default mongoose.model("Product", productSchema);
