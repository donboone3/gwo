"use client";

import React, { useState } from "react";
import {
  Check,
  ExternalLink,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";

export function DropshipCheckoutModal() {
  const {
    bagItems,
    dropshipCheckoutOpen,
    dropshipCheckoutTab,
    setDropshipCheckoutTab,
    closeDropshipCheckout,
    dropshipOrders,
    placeDropshipOrder,
    dispatchDropshipOrder,
    user,
  } = useGwo();

  const [customerName, setCustomerName] = useState(
    user?.displayName || "Mila Vance"
  );
  const [customerEmail, setCustomerEmail] = useState("mila@goodwithonline.com");
  const [shippingAddress, setShippingAddress] = useState(
    "458 Mercer St, Apt 4B"
  );
  const [cityPostal, setCityPostal] = useState("New York, NY 10013");
  const [justPlacedId, setJustPlacedId] = useState<string | null>(null);

  if (!dropshipCheckoutOpen) return null;

  const bagTotal = bagItems.reduce((s, i) => s + i.price, 0);
  const pendingCount = dropshipOrders.filter(
    (o) => o.status === "awaiting_supplier_dispatch"
  ).length;

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (bagItems.length === 0) return;
    const created = placeDropshipOrder({
      customerName,
      customerEmail,
      shippingAddress,
      cityPostal,
    });
    if (created) {
      setJustPlacedId(created.orderId);
      setDropshipCheckoutTab("fulfillment");
    }
  };

  return (
    <div
      id="gwo-dropship-checkout-modal"
      className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={closeDropshipCheckout}
    >
      <div
        className="w-full max-w-3xl max-h-[92svh] rounded-3xl bg-white shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + Customer vs Merchant Fulfillment Switcher */}
        <div className="shrink-0 px-5 py-4 border-b border-black/[0.07] flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> GWO Boutique Express Checkout &amp; Auto-Dropship
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#141518] mt-1">
              {dropshipCheckoutTab === "checkout"
                ? "Complete Your GWO Boutique Order"
                : "Merchant Supplier Auto-Fulfillment Queue"}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
              <button
                type="button"
                id="gwo-ds-tab-checkout"
                onClick={() => setDropshipCheckoutTab("checkout")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  dropshipCheckoutTab === "checkout"
                    ? "bg-white text-[#141518] shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                Shopper Checkout ({bagItems.length})
              </button>
              <button
                type="button"
                id="gwo-ds-tab-fulfillment"
                onClick={() => setDropshipCheckoutTab("fulfillment")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  dropshipCheckoutTab === "fulfillment"
                    ? "bg-[#244B3B] text-white shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                Supplier Queue ({pendingCount || dropshipOrders.length})
              </button>
            </div>

            <button
              type="button"
              id="gwo-ds-checkout-close"
              onClick={closeDropshipCheckout}
              aria-label="Close Dropship Checkout"
              className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {dropshipCheckoutTab === "checkout" ? (
            bagItems.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <ShoppingBag className="w-8 h-8 mx-auto text-[#9CA3AF]" />
                <p className="text-sm font-bold text-[#141518]">
                  Your GWO Boutique Bag is currently empty
                </p>
                <p className="text-xs text-[#686D76]">
                  Add any outfit or dropship garment, or inspect fulfilled orders in the Supplier Queue tab.
                </p>
                <button
                  type="button"
                  onClick={() => setDropshipCheckoutTab("fulfillment")}
                  className="px-4 py-2 rounded-full bg-[#141518] text-white text-xs font-bold cursor-pointer"
                >
                  View Merchant Supplier Queue ({dropshipOrders.length})
                </button>
              </div>
            ) : (
              <form
                onSubmit={handlePlaceOrder}
                className="grid grid-cols-1 md:grid-cols-2 gap-5"
              >
                {/* Left: Clean Retail Shipping Form (Zero Supplier/Wholesale Exposure!) */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                    1. Express Delivery Details (5–7 Business Days)
                  </p>

                  <label className="block text-[11px] font-bold text-[#141518]">
                    Full Name
                    <input
                      required
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-[#141518]">
                    Order Confirmation Email
                    <input
                      required
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-[#141518]">
                    Street Address
                    <input
                      required
                      type="text"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-[#141518]">
                    City, State &amp; Postal Code
                    <input
                      required
                      type="text"
                      value={cityPostal}
                      onChange={(e) => setCityPostal(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                    />
                  </label>

                  <div className="p-3 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] text-[11px] text-[#1D4232] space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> Free Direct Air Boutique Delivery
                    </p>
                    <p className="text-[#3C5A4C]">
                      Every garment size is pre-verified against your{" "}
                      <strong>5&apos;2&quot; • 32.25&quot; • 27&quot; • 34&quot;</strong>{" "}
                      avatar profile before dispatch.
                    </p>
                  </div>
                </div>

                {/* Right: Retail Bag Summary + Place Order CTA */}
                <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex flex-col justify-between gap-4">
                  <div className="space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                      2. Your Exact-Fit Order ({bagItems.length} Pieces)
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {bagItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-11 h-14 rounded-lg object-cover bg-[#F4F5F7] shrink-0"
                              />
                            ) : (
                              <div className="w-11 h-14 rounded-lg bg-[#EAECEF] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[10.5px] font-bold text-[#244B3B] truncate">
                                {item.brand} • US Size {item.size}
                              </p>
                              <p className="text-xs font-bold text-[#141518] truncate">
                                {item.title}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-extrabold text-[#141518] shrink-0">
                            ${item.price}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-black/[0.08]">
                    <div className="flex items-center justify-between text-xs text-[#686D76]">
                      <span>Direct Air Tracked Shipping</span>
                      <strong className="text-[#15803D]">FREE</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm font-bold text-[#141518]">
                      <span>Boutique Order Total</span>
                      <span className="text-lg">${bagTotal.toLocaleString()}</span>
                    </div>

                    <button
                      type="submit"
                      id="gwo-place-boutique-order-btn"
                      className="w-full py-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
                      Place GWO Boutique Order (${bagTotal.toLocaleString()})
                    </button>
                  </div>
                </div>
              </form>
            )
          ) : (
            /* ==================== MERCHANT SUPPLIER AUTO-FULFILLMENT QUEUE ==================== */
            <div className="space-y-4">
              {justPlacedId && (
                <div className="p-3.5 rounded-2xl bg-[#E7F3EE] border border-[#B7DEC9] flex items-center justify-between gap-2 text-xs text-[#1D4232] font-bold">
                  <span>
                    ✓ Retail Order {justPlacedId} captured! Customer US sizes have been mapped to AliExpress Supplier Tags below.
                  </span>
                </div>
              )}

              {dropshipOrders.map((ord) => {
                const isDispatched = ord.status === "dispatched_choice_air";
                return (
                  <div
                    key={ord.orderId}
                    className="rounded-2xl bg-[#F8F9FB] border border-black/[0.08] p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-black/[0.06]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-[#141518]">
                            {ord.orderId}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                              isDispatched
                                ? "bg-[#E7F3EE] text-[#1D4232]"
                                : "bg-[#FEF6E6] text-[#8A5808]"
                            }`}
                          >
                            {isDispatched
                              ? `Dispatched • ${ord.trackingNumber || "Choice Air"}`
                              : "Awaiting Supplier Auto-Dispatch"}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#686D76] mt-0.5">
                          Ship To: <strong>{ord.customerName}</strong> •{" "}
                          {ord.shippingAddress}, {ord.cityPostal}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="px-3 py-1.5 rounded-xl bg-white border border-black/[0.07] text-[11px]">
                          <span className="text-[#686D76]">Retail: </span>
                          <strong className="text-[#141518]">
                            ${ord.totalRetailCollectedUsd.toFixed(0)}
                          </strong>
                          <span className="mx-1.5 text-black/20">|</span>
                          <span className="text-[#686D76]">Supplier: </span>
                          <strong className="text-[#141518]">
                            ${ord.totalSupplierWholesaleUsd.toFixed(2)}
                          </strong>
                          <span className="mx-1.5 text-black/20">|</span>
                          <strong className="text-[#15803D]">
                            Net +${ord.totalNetStoreProfitUsd.toFixed(2)}
                          </strong>
                        </div>

                        {!isDispatched && (
                          <button
                            type="button"
                            onClick={() => dispatchDropshipOrder(ord.orderId)}
                            className="px-3.5 py-2 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            Auto-Dispatch All SKUs
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Line Items with CN Size Calibration & 1-Click Supplier Link */}
                    <div className="space-y-2">
                      {ord.lines.map((ln) => (
                        <div
                          key={ln.lineId}
                          className="p-2.5 rounded-xl bg-white border border-black/[0.06] flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {ln.imageUrl ? (
                              <img
                                src={ln.imageUrl}
                                alt={ln.title}
                                className="w-10 h-12 rounded-lg object-cover bg-[#F4F5F7] shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-12 rounded-lg bg-[#EAECEF] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#141518] truncate">
                                {ln.title}
                              </p>
                              <p className="text-[11px] text-[#5C6068]">
                                Customer Ordered{" "}
                                <strong>US {ln.customerUsSize}</strong> →{" "}
                                <strong className="text-[#244B3B]">
                                  Fulfill {ln.supplierFulfillmentTag}
                                </strong>
                                {ln.isDropship
                                  ? ` • Cost $${ln.wholesaleCostUsd.toFixed(
                                      2
                                    )} → Profit +$${ln.netProfitUsd.toFixed(2)}`
                                  : " • Partner Storefront Item"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {ln.isDropship && ln.supplierUrl ? (
                              <a
                                href={ln.supplierUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center gap-1"
                              >
                                Supplier SKU <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : ln.partnerStoreUrl ? (
                              <a
                                href={ln.partnerStoreUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EB] text-[#141518] text-[11px] font-bold inline-flex items-center gap-1"
                              >
                                Partner Store <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] font-bold text-[#15803D] inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Ready
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
