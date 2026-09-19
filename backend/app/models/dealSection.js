import mongoose from "mongoose";

const dealSectionSchema = new mongoose.Schema(
  {
    sectionKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      enum: [
        "todays-deals",
        "lowest-price-ever",
        "trending-products",
        "best-value-deals",
      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    hasTimer: {
      type: Boolean,
      default: false,
    },
    iconName: {
      type: String,
      default: "ShoppingBag",
    },
    iconBg: {
      type: String,
      default: "bg-orange-50",
    },
    iconColor: {
      type: String,
      default: "text-[#FF8200]",
    },
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

dealSectionSchema.index({ status: 1, order: 1 });

export default mongoose.model("DealSection", dealSectionSchema);
