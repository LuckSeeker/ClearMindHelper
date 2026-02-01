import React, { useState } from "react";
import type { UserProfileDTO, UpdateUserProfileCommand } from "../types";
import { Button } from "./ui/button";

interface ProfileFormProps {
  profile: UserProfileDTO | null;
  onSubmit: (data: UpdateUserProfileCommand) => void;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

const initialState = {
  height_cm: "",
  weight_kg: "",
  gender: "",
};

const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onSubmit, isSubmitting, errors }) => {
  const [form, setForm] = useState({
    height_cm: profile?.height_cm?.toString() ?? initialState.height_cm,
    weight_kg: profile?.weight_kg?.toString() ?? initialState.weight_kg,
    gender: profile?.gender ?? initialState.gender,
  });
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  // Synchronizuj stan formularza z profile, gdy profile się zmieni
  React.useEffect(() => {
    setForm({
      height_cm: profile?.height_cm?.toString() ?? initialState.height_cm,
      weight_kg: profile?.weight_kg?.toString() ?? initialState.weight_kg,
      gender: profile?.gender ?? initialState.gender,
    });
  }, [profile]);

  const validate = () => {
    const errs: Record<string, string> = {};
    const h = Number(form.height_cm);
    const w = Number(form.weight_kg);
    if (!form.height_cm || isNaN(h) || h < 50 || h > 250) errs.height_cm = "Wzrost musi być w zakresie 50-250 cm";
    if (!form.weight_kg || isNaN(w) || w < 30 || w > 300) errs.weight_kg = "Waga musi być w zakresie 30-300 kg";
    if (!form.gender || !["M", "F"].includes(form.gender)) errs.gender = "Wybierz płeć (M/F)";
    return errs;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setLocalErrors(errs);
    if (Object.keys(errs).length === 0) {
      onSubmit({
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        gender: form.gender as "M" | "F",
      });
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit} aria-labelledby="profile-form-title" data-testid="profile-form">
      <h3 id="profile-form-title" className="sr-only">
        Formularz profilu
      </h3>
      <div>
        <label htmlFor="height_cm" className="block font-medium">
          Wzrost (cm)
        </label>
        <input
          type="number"
          name="height_cm"
          id="height_cm"
          data-testid="height-input"
          min={50}
          max={250}
          value={form.height_cm}
          onChange={handleChange}
          className="input input-bordered w-full"
          aria-describedby="height_cm_error"
          required
        />
        {(localErrors.height_cm || errors.height_cm) && (
          <span id="height_cm_error" className="text-red-500 text-sm" role="alert" aria-live="assertive">
            {localErrors.height_cm || errors.height_cm}
          </span>
        )}
      </div>
      <div>
        <label htmlFor="weight_kg" className="block font-medium">
          Waga (kg)
        </label>
        <input
          type="number"
          name="weight_kg"
          id="weight_kg"
          data-testid="weight-input"
          min={30}
          max={300}
          value={form.weight_kg}
          onChange={handleChange}
          className="input input-bordered w-full"
          aria-describedby="weight_kg_error"
          required
        />
        {(localErrors.weight_kg || errors.weight_kg) && (
          <span id="weight_kg_error" className="text-red-500 text-sm" role="alert" aria-live="assertive">
            {localErrors.weight_kg || errors.weight_kg}
          </span>
        )}
      </div>
      <div>
        <label htmlFor="gender" className="block font-medium">
          Płeć
        </label>
        <select
          name="gender"
          data-testid="gender-select"
          id="gender"
          value={form.gender}
          onChange={handleChange}
          className="select select-bordered w-full"
          aria-describedby="gender_error"
          required
        >
          <option value="">Wybierz...</option>
          <option value="M">Mężczyzna</option>
          <option value="F">Kobieta</option>
        </select>
        {(localErrors.gender || errors.gender) && (
          <span id="gender_error" className="text-red-500 text-sm" role="alert" aria-live="assertive">
            {localErrors.gender || errors.gender}
          </span>
        )}
      </div>
      <div>
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Zapisywanie..." : "Zapisz profil"}
        </Button>
      </div>
      {errors.global && (
        <div className="text-red-500 text-sm mt-2" role="alert" aria-live="assertive">
          {errors.global}
        </div>
      )}
    </form>
  );
};

export default ProfileForm;
