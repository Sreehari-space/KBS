import { useCallback, useRef, useState } from 'react';
import { isTanglish, suggestNames, type NameSuggestion } from '@/domain/tamil/suggest';
import { detectScript } from '@/domain/tamil/transliterate';

export interface NameFields {
  nameEn: string;
  nameTa: string;
  /** True once the Tamil field has been typed in by hand. */
  tamilEdited: boolean;
  /** Set when the Tamil name is a sound-alike rather than a real translation. */
  suggestion: NameSuggestion | null;
}

const EMPTY: NameFields = {
  nameEn: '',
  nameTa: '',
  tamilEdited: false,
  suggestion: null,
};

/**
 * Keeps the English and Tamil name fields in step as the shopkeeper types.
 *
 *   "Tomato"    -> Tamil filled with தக்காளி
 *   "thakkali"  -> English corrected to Tomato, Tamil filled with தக்காளி
 *   "தக்காளி"    -> English filled with Tomato
 *
 * Two rules keep it from being annoying:
 *
 * 1. **Manual edits win.** Once the Tamil field is touched by hand, nothing
 *    overwrites it. A wrong auto-translation on a printed bill is worse than
 *    a blank one, so the shopkeeper always gets the last word.
 * 2. **English is only rewritten for Tanglish.** Typing "Tomato" must not
 *    have the field rewritten underneath the cursor; typing "thakkali" should
 *    resolve to "Tomato", because that is plainly what was meant.
 */
export function useNameSuggestion(initial?: Partial<NameFields>) {
  const [fields, setFields] = useState<NameFields>({ ...EMPTY, ...initial });
  const tamilEdited = useRef(Boolean(initial?.tamilEdited));

  const setEnglish = useCallback((value: string) => {
    const suggestion = suggestNames(value);
    setFields((cur) => {
      // Tanglish resolves to a real English name; Tamil script typed into this
      // field does too. Plain English is left exactly as typed.
      const typedTamil = detectScript(value) === 'tamil';
      const nameEn =
        (isTanglish(value) || typedTamil) && suggestion.nameEn ? suggestion.nameEn : value;
      // When Tamil was typed here, that IS the Tamil name.
      const nameTa = tamilEdited.current ? cur.nameTa : typedTamil ? value : suggestion.nameTa;
      return {
        nameEn,
        nameTa,
        tamilEdited: tamilEdited.current,
        suggestion: tamilEdited.current ? null : suggestion,
      };
    });
  }, []);

  const setTamil = useCallback((value: string) => {
    tamilEdited.current = true;
    setFields((cur) => ({ ...cur, nameTa: value, tamilEdited: true, suggestion: null }));
  }, []);

  const reset = useCallback((next?: Partial<NameFields>) => {
    tamilEdited.current = Boolean(next?.tamilEdited);
    setFields({ ...EMPTY, ...next });
  }, []);

  return { fields, setEnglish, setTamil, reset };
}
