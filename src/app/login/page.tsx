"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LoginLogo } from "@/components/login/logo-button";

const CORRECT_CODE = "192438";

export default function LoginPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pin, setPin] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const gridSpotlightRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isModalOpen && gridSpotlightRef.current) {
        gridSpotlightRef.current.style.setProperty("--x", `${e.clientX}px`);
        gridSpotlightRef.current.style.setProperty("--y", `${e.clientY}px`);
        gridSpotlightRef.current.style.opacity = "1";
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isModalOpen]);

  const openModal = () => {
    setIsModalOpen(true);
    setPin(Array(6).fill(""));
    setError(false);
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const value = e.target.value;
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const checkCode = () => {
    if (pin.join("") === CORRECT_CODE) {
      router.push("/dashboard");
    } else {
      setError(true);
      modalContentRef.current?.classList.add("shake");
      setTimeout(() => {
        modalContentRef.current?.classList.remove("shake");
        setError(false);
        setPin(Array(6).fill(""));
        inputRefs.current[0]?.focus();
      }, 800);
    }
  };
  
  useEffect(() => {
      if (pin.every(p => p !== '')) {
          checkCode();
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="flex items-center justify-center h-screen bg-black text-white overflow-hidden">
      <div className="grid-container">
        <div className="grid-lines" />
        <div ref={gridSpotlightRef} className="grid-spotlight" />
      </div>

      <div
        className="svg-container cursor-pointer transition-transform duration-500 hover:scale-110 hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
        onClick={openModal}
      >
        <LoginLogo />
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10 transition-opacity duration-300">
          <div
            ref={modalContentRef}
            className={cn(
              "terminal-window w-96 relative p-8 transition-all duration-400 transform opacity-0 translate-y-5",
              isModalOpen && "opacity-100 translate-y-0"
            )}
          >
            <div className="flex flex-col items-center justify-center">
              <div className="mb-8 flex justify-center space-x-2">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="password"
                    maxLength={1}
                    className={cn(
                      "digit-input",
                      digit && "filled",
                      error && "bg-red-500/20 !text-red-500 border-red-500"
                    )}
                    value={digit}
                    onChange={(e) => handleInputChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    inputMode="numeric"
                  />
                ))}
              </div>

              <div className="flex space-x-4 w-full">
                <button
                  onClick={closeModal}
                  className="terminal-button cancel-button w-1/2 py-3 text-sm"
                >
                  CANCELAR
                </button>
                <button
                  onClick={checkCode}
                  className="terminal-button w-1/2 py-3 text-sm"
                >
                  INICIAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
