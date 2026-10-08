import React, { useState, useEffect, useCallback } from "react";
import PageHeader from "@shared/components/ui/PageHeader";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Loader from "@shared/components/ui/Loader";
import { warehouseMgmtApi } from "../services/warehouseMgmtApi";
import { useWarehouseContext } from "../hooks/useWarehouseContext";
import {
  MapPin,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Truck,
  Upload,
  Phone,
  Mail,
  Hash,
  Globe,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";

/** Generate a Shiprocket-compatible pickup nickname from warehouse name */
function generatePickupNickname(warehouseName) {
  return (warehouseName || "Warehouse")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase()
    .slice(0, 36);
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Chandigarh",
];

const INITIAL_FORM = {
  pickup_location: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  address_2: "",
  city: "",
  state: "",
  pin_code: "",
};

export const PickupAddresses = () => {
  const { isAdmin, isWarehouseUser, warehouseId: contextWarehouseId } = useWarehouseContext();
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const statusRes = await warehouseMgmtApi.getPickupSyncStatus();
      const items = statusRes.data?.result?.items || [];
      setWarehouses(items);

      if (items.length > 0) {
        // Find default warehouse to select
        const initial = isWarehouseUser && contextWarehouseId
          ? items.find((w) => w.id === String(contextWarehouseId)) || items[0]
          : items[0];

        setSelectedWarehouseId(initial.id);
        populateFormFromWarehouse(initial);
      }
    } catch (err) {
      toast.error("Failed to load warehouse pickup details");
    } finally {
      setLoading(false);
    }
  }, [isWarehouseUser, contextWarehouseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const populateFormFromWarehouse = (wh) => {
    if (!wh) return;
    setFormData({
      pickup_location: wh.shiprocketPickupLocation || generatePickupNickname(wh.warehouseName),
      name: wh.name || "",
      email: wh.email || "",
      phone: wh.phone || "",
      address: (wh.address || "").slice(0, 80),
      address_2: (wh.locality || "").slice(0, 80),
      city: wh.city || "Indore",
      state: wh.state || "Madhya Pradesh",
      pin_code: wh.pincode || "",
    });
  };

  const handleWarehouseChange = (e) => {
    const whId = e.target.value;
    setSelectedWarehouseId(whId);
    const wh = warehouses.find((w) => w.id === whId);
    if (wh) {
      populateFormFromWarehouse(wh);
    }
  };

  const handleChange = (field) => (e) => {
    let value = e.target.value;
    if (field === "pickup_location") {
      value = value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase().slice(0, 36);
    }
    if (field === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10);
    }
    if (field === "pin_code") {
      value = value.replace(/\D/g, "").slice(0, 6);
    }
    if (field === "address" || field === "address_2") {
      value = value.slice(0, 80);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWarehouseId) {
      toast.error("Please select a warehouse");
      return;
    }

    // Validation matching Shiprocket constraints
    if (!formData.pickup_location.trim()) {
      toast.error("Pickup Location Nickname is required");
      return;
    }
    if (!formData.name.trim()) {
      toast.error("Contact Person / Shipper Name is required");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("Contact Email is required");
      return;
    }
    if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ""))) {
      toast.error("Phone number must be exactly 10 digits");
      return;
    }
    if (!formData.address.trim()) {
      toast.error("Address Line 1 is required");
      return;
    }
    if (!formData.city.trim() || !formData.state.trim()) {
      toast.error("City and State are required");
      return;
    }
    if (!/^\d{6}$/.test(formData.pin_code.replace(/\D/g, ""))) {
      toast.error("PIN Code must be exactly 6 digits");
      return;
    }

    setSyncing(true);
    try {
      const res = await warehouseMgmtApi.syncPickupAddress(selectedWarehouseId, formData);
      if (res.data?.success !== false && res.status !== 500) {
        toast.success(
          `✅ Pickup address "${formData.pickup_location}" synced to Shiprocket & saved!`
        );
        // Refresh warehouse sync status list
        const statusRes = await warehouseMgmtApi.getPickupSyncStatus();
        const items = statusRes.data?.result?.items || [];
        setWarehouses(items);
      } else {
        toast.error(res.data?.message || "Failed to sync pickup address");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to sync pickup address to Shiprocket"
      );
    } finally {
      setSyncing(false);
    }
  };

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Shiprocket Pickup Address"
        description="Configure your warehouse pickup address. All courier shipments and AWB labels created from this warehouse will automatically be dispatched from this synced address."
      />

      {/* Warehouse Selector (if multiple exist) */}
      {warehouses.length > 1 && isAdmin && (
        <Card className="p-4 border-l-4 border-l-primary bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="text-primary shrink-0" />
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Select Warehouse to Configure
                </label>
                <p className="text-[11px] text-slate-400">
                  Each warehouse can have its own dedicated Shiprocket pickup nickname & location.
                </p>
              </div>
            </div>
            <select
              value={selectedWarehouseId}
              onChange={handleWarehouseChange}
              className="ds-input font-bold text-xs py-2 px-3 bg-white min-w-[240px]"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.warehouseName} ({wh.city}) {wh.shiprocketPickupSynced ? "— ✅ Synced" : "— ⚠️ Pending"}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {/* Active Sync Status Card */}
      {selectedWarehouse && (
        <div
          className={`rounded-2xl p-4 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            selectedWarehouse.shiprocketPickupSynced
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
              : "bg-amber-50/80 border-amber-200 text-amber-950"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedWarehouse.shiprocketPickupSynced
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {selectedWarehouse.shiprocketPickupSynced ? (
                <CheckCircle2 size={22} />
              ) : (
                <AlertTriangle size={22} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm">
                  {selectedWarehouse.warehouseName}
                </span>
                <Badge
                  variant={selectedWarehouse.shiprocketPickupSynced ? "success" : "warning"}
                >
                  {selectedWarehouse.shiprocketPickupSynced
                    ? "✅ Live Synced to Shiprocket"
                    : "⚠️ Sync Pending"}
                </Badge>
              </div>
              <p className="text-xs mt-0.5 text-slate-600">
                {selectedWarehouse.shiprocketPickupSynced ? (
                  <>
                    Active Shiprocket Nickname:{" "}
                    <code className="font-mono font-bold bg-white/80 px-2 py-0.5 rounded text-emerald-900 border border-emerald-200">
                      {selectedWarehouse.shiprocketPickupLocation}
                    </code>{" "}
                    — Courier pickups will arrive at this address.
                  </>
                ) : (
                  "This warehouse address is not yet registered on Shiprocket. Fill the form below and click 'Save & Sync to Shiprocket'."
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <Truck size={14} className="text-primary" /> Auto-Shipment Ready
            </span>
          </div>
        </div>
      )}

      {/* Main Shiprocket Pickup Address Form */}
      <Card className="p-6 md:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Header */}
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <MapPin size={18} className="text-primary" />
                Shiprocket Pickup Address Form
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact address format required by Shiprocket API for courier pickups and automated AWB generation.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
              <Sparkles size={13} /> Official Shiprocket Format
            </div>
          </div>

          {/* Pickup Nickname */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Hash size={14} className="text-primary" />
                Pickup Location Nickname <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {formData.pickup_location.length}/36 chars
              </span>
            </div>
            <input
              type="text"
              value={formData.pickup_location}
              onChange={handleChange("pickup_location")}
              className="ds-input w-full font-mono uppercase font-bold text-sm bg-white"
              placeholder="e.g. WAREHOUSE or INDORE_PRIMARY_HUB"
              maxLength={36}
              required
            />
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info size={12} className="text-slate-400 shrink-0" />
              Unique identifier used by Shiprocket when scheduling courier dispatches. Uppercase letters, numbers, and underscores only.
            </p>
          </div>

          {/* Contact Person Details */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Shipper & Contact Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Contact Person / Shipper Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={handleChange("name")}
                  className="ds-input w-full"
                  placeholder="e.g. Rahul Sharma"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Mail size={12} className="text-slate-400" />
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={handleChange("email")}
                  className="ds-input w-full"
                  placeholder="e.g. warehouse@jainaahar.in"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Phone size={12} className="text-slate-400" />
                  Phone Number (10 Digits) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange("phone")}
                  className="ds-input w-full font-mono"
                  placeholder="9876543210"
                  maxLength={10}
                  required
                />
              </div>
            </div>
          </div>

          {/* Physical Address Details */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Physical Pickup Address
            </h4>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Address Line 1 (Building / Street / Industrial Area) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {formData.address.length}/80
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.address}
                  onChange={handleChange("address")}
                  className="ds-input w-full"
                  placeholder="e.g. Plot No. 12, Sector 3, Industrial Area"
                  maxLength={80}
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Address Line 2 (Area / Locality / Landmark)
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {formData.address_2.length}/80
                  </span>
                </div>
                <input
                  type="text"
                  value={formData.address_2}
                  onChange={handleChange("address_2")}
                  className="ds-input w-full"
                  placeholder="e.g. Near City Warehouse Hub, Sanwer Road"
                  maxLength={80}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={handleChange("city")}
                    className="ds-input w-full"
                    placeholder="e.g. Indore"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    list="indian-states-list"
                    value={formData.state}
                    onChange={handleChange("state")}
                    className="ds-input w-full"
                    placeholder="e.g. Madhya Pradesh"
                    required
                  />
                  <datalist id="indian-states-list">
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    PIN Code (6 Digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.pin_code}
                    onChange={handleChange("pin_code")}
                    className="ds-input w-full font-mono font-bold"
                    placeholder="452001"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              {/* Country Badge */}
              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-xs text-slate-500 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-primary" />
                  <span className="font-semibold text-slate-700">Country:</span>
                  <span className="font-bold text-slate-900">India</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Shiprocket India Express Delivery Network
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              Direct API sync with Shiprocket external company pickup endpoint.
            </div>

            <button
              type="submit"
              disabled={syncing}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Saving & Syncing with Shiprocket...
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Save & Sync to Shiprocket
                </>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default PickupAddresses;
