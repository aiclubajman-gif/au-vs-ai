'use client';

import { useState, useEffect } from 'react';
import {
  AVATAR_OPTIONS,
  type Gender,
  getStoredAvatar,
  setStoredAvatar,
  getStoredGender,
  setStoredGender,
} from '@/lib/avatars';
import { PxButton, PxPanel } from '@/components/px';

export interface ChangeAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (avatarId: string, gender: Gender) => void;
}

export function ChangeAvatarModal({ isOpen, onClose, onSave }: ChangeAvatarModalProps) {
  const [gender, setGender] = useState<Gender>('Male');
  const [avatar, setAvatar] = useState<string>('avatar_boy_1');

  useEffect(() => {
    if (isOpen) {
      setGender(getStoredGender());
      setAvatar(getStoredAvatar());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentSlots = AVATAR_OPTIONS[gender] ?? AVATAR_OPTIONS.Male;

  const handleGenderChange = (newGender: Gender) => {
    setGender(newGender);
    // Auto-swap to matching slot index in the other gender
    const prevSlots = AVATAR_OPTIONS[gender];
    const prevIdx = prevSlots.findIndex((a) => a.id === avatar);
    const newSlots = AVATAR_OPTIONS[newGender];
    const nextAv = newSlots[prevIdx >= 0 ? prevIdx : 0].id;
    setAvatar(nextAv);
  };

  const handleConfirm = () => {
    setStoredGender(gender);
    setStoredAvatar(avatar);
    onSave?.(avatar, gender);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-avatar-title"
    >
      <div className="relative w-full max-w-[460px]">
        <PxPanel tone="cyan" className="p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-[#1e4ea8]/60 pb-3">
            <div>
              <h2 id="change-avatar-title" className="font-px text-[14px] text-[#ffe66a] px-text-outline sm:text-[16px]">
                CHOOSE YOUR AVATAR
              </h2>
              <p className="mt-1 font-px text-[7px] text-[#9fb3e6] sm:text-[8px]">
                SELECT GENDER & PICK FROM 3 AVATAR STYLES
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e4ea8] bg-[#07163a] font-px text-xs text-[#9fb3e6] transition-colors hover:border-[#ffe66a] hover:text-white"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>

          {/* Gender Buttons */}
          <div className="mt-4">
            <p className="font-px text-[8px] text-[#ffe66a]">GENDER</p>
            <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gender">
              {(['Male', 'Female'] as const).map((g) => (
                <PxButton
                  key={g}
                  variant={gender === g ? 'cyan' : 'navy'}
                  onClick={() => handleGenderChange(g)}
                  className="min-h-[44px] text-[9px]"
                  ariaLabel={g}
                >
                  {g.toUpperCase()}
                </PxButton>
              ))}
            </div>
          </div>

          {/* 3 Avatar Slots */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="font-px text-[8px] text-[#ffe66a]">SELECT AVATAR</p>
              <span className="font-px text-[7px] text-[#7ffafe]">3 CHOICES</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Avatar slots">
              {currentSlots.map((av, index) => {
                const isSelected = avatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatar(av.id)}
                    className={`group relative flex flex-col items-center justify-center rounded-xl border p-2 transition-all duration-150 ${
                      isSelected
                        ? 'border-[#ffe66a] bg-[#0c2a66] shadow-[0_0_12px_rgba(255,230,106,0.35)] ring-2 ring-[#ffe66a]'
                        : 'border-[#1e4ea8] bg-[#07163a]/80 hover:border-[#7ffafe] hover:bg-[#0c2357]'
                    }`}
                    aria-label={`${gender} avatar ${index + 1}`}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
                      <img
                        src={av.src}
                        alt={av.label}
                        className={`h-full w-full object-contain transition-transform duration-150 ${
                          isSelected ? 'scale-105' : 'group-hover:scale-105 opacity-85 group-hover:opacity-100'
                        }`}
                      />
                    </div>
                    <span
                      className={`mt-1 font-px text-[7px] ${
                        isSelected ? 'font-bold text-[#ffe66a]' : 'text-[#9fb3e6] group-hover:text-white'
                      }`}
                    >
                      {isSelected ? 'SELECTED' : `STYLE ${index + 1}`}
                    </span>
                    {isSelected && (
                      <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ffe66a] text-[#041030] shadow">
                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <PxButton
              variant="cyan"
              onClick={handleConfirm}
              className="min-h-[48px] flex-1 text-[11px]"
            >
              SAVE AVATAR ✓
            </PxButton>
            <PxButton
              variant="navy"
              onClick={onClose}
              className="min-h-[44px] sm:min-h-[48px] sm:w-[100px] text-[9px]"
            >
              CANCEL
            </PxButton>
          </div>
        </PxPanel>
      </div>
    </div>
  );
}
