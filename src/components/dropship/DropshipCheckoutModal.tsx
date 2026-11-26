"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";

export function DropshipCheckoutModal() {
  const router = useRouter();
  const {
    bagItems,
    dropshipCheckoutOpen,
    closeDropshipCheckout,
    placeDropshipOrder,
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
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  if (!dropshipCheckoutOpen) return null;

  const bagTotal = bagItems.reduce((s, i) => s + i.price, 0);

  const handleClose = () => {
    setConfirmedOrderId(null);
    closeDropshipCheckout();
  };

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
      setConfirmedOrderId(created.orderId);
    }
  };

  return (
    <div
      id="gwo-dropship-checkout-modal"
      className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92svh] rounded-3xl bg-white shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Clean Customer-Only Retail Header */}
        <div className="shrink-0 px-5 py-4 border-b border-black/[0.07] flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> GWO Express Checkout • Exact-Fit Verified
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#141518] mt-1">
              {confirmedOrderId
                ? `Order ${confirmedOrderId} Confirmed!`
                : "Complete Your Outfit Order"}
            </h3>
          </div>

          <button
            type="button"
            id="gwo-ds-checkout-close"
            onClick={handleClose}
            aria-label="Close Checkout"
            className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {confirmedOrderId ? (
            <div className="py-8 text-center space-y-4 max-w-md mx-auto">
              <CheckCircle2 className="w-12 h-12 mx-auto text-[#244B3B]" />
              <div className="space-y-1.5">
                <h4 className="text-lg font-bold text-[#141518]">
                  Added Directly to Your Personal Closet!
                </h4>
                <p className="text-xs text-[#5C6068] leading-relaxed">
                  Your order <strong>{confirmedOrderId}</strong> is confirmed with free 5–7 day tracked delivery, and your new pieces are already waiting in your <strong>Closet</strong> to mix, match, and swipe on your avatar.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    router.push("/");
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold cursor-pointer transition"
                >
                  Open My Closet &amp; Try On →
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EB] text-[#141518] text-xs font-bold cursor-pointer transition"
                >
                  Keep Shopping Runway
                </button>
              </div>
            </div>
          ) : bagItems.length === 0 ? (
            <div className="py-12 text-center space-y-2.5">
              <ShoppingBag className="w-8 h-8 mx-auto text-[#9CA3AF]" />
              <p className="text-sm font-bold text-[#141518]">
                Your Cart is empty
              </p>
              <p className="text-xs text-[#686D76]">
                Slide through the Runway to buy single pieces or full AI outfits.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handlePlaceOrder}
              className="grid grid-cols-1 md:grid-cols-2 gap-5"
            >
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                  1. Delivery Address
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
                  Email
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
                  City, State &amp; ZIP
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
                    <Truck className="w-3.5 h-3.5" /> Free Tracked Express Shipping
                  </p>
                  <p className="text-[#3C5A4C]">
                    Sizes verified for your{" "}
                    <strong>5&apos;2&quot; • 32.25&quot; • 27&quot; • 34&quot;</strong>{" "}
                    avatar. Bought items automatically unlock in your Closet.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                    2. Order Summary ({bagItems.length} Pieces)
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
                              Size {item.size} • Exact Fit
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
                    <span>Shipping</span>
                    <strong className="text-[#15803D]">FREE</strong>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-[#141518]">
                    <span>Order Total</span>
                    <span className="text-lg">${bagTotal.toLocaleString()}</span>
                  </div>

                  <button
                    type="submit"
                    id="gwo-place-boutique-order-btn"
                    className="w-full py-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
                    Buy Now (${bagTotal.toLocaleString()})
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
