#!/usr/bin/env python3
"""
Logic Test System for Fiqih Haid Calculation
Khusus kasus Mu'tadah Ghoiru Mumayyizah

Input format: ah <nilai> as <nilai> kd <nilai> b <nilai> kd <nilai>
Output: Perhitungan status haid dan istihadloh
"""

def process_input(input_string):
    """
    Process input untuk kasus Mu'tadah Ghoiru Mumayyizah
    Format input: ah 9 as 20 kd 21 b 10 kd 2
    
    Logika:
    - ah = Ahad Haid (kebiasaan haid sebelumnya)
    - as = Ahad Suci (kebiasaan suci sebelumnya)
    - kd pertama = Kedatangan darah pertama kali
    - b = Masa bersih setelah keluar darah pertama
    - kd kedua = Kedatangan darah kedua
    
    Untuk Mu'tadah Ghoiru Mumayyizah:
    - Jika darah keluar < 15 hari: dianggap haid sesuai kebiasaan (ah)
    - Sisanya adalah istihadloh
    """
    parts = input_string.split()
    
    # Parse input
    data = {}
    kd_count = 0  # Counter untuk kd
    i = 0
    while i < len(parts):
        if parts[i] in ['ah', 'as', 'kd', 'b']:
            key = parts[i]
            if key == 'kd':
                # kd bisa muncul 2 kali
                kd_count += 1
                if kd_count == 1:
                    data['kd1'] = int(parts[i+1])
                else:
                    data['kd2'] = int(parts[i+1])
            else:
                data[key] = int(parts[i+1])
            i += 2
        else:
            i += 1
    
    # Validasi input
    required_keys = ['ah', 'as', 'kd1', 'b', 'kd2']
    if not all(key in data for key in required_keys):
        return "Invalid input format. Gunakan: ah <n> as <n> kd <n> b <n> kd <n>"
    
    ah = data['ah']      # Ahad Haid = 9
    as_val = data['as']  # Ahad Suci = 20
    kd1 = data['kd1']    # Kedatangan pertama = 21
    b = data['b']        # Bersih = 10
    kd2 = data['kd2']    # Kedatangan kedua = 2
    
    # Logika Mu'tadah Ghoiru Mumayyizah
    # Darah pertama 21 hari: 
    # - Haid = ah (9 hari) karena sudah punya kebiasaan
    # - Istihadloh = kd1 - ah = 21 - 9 = 12 hari
    
    haid_pertama = ah
    istihadloh_pertama = kd1 - ah
    
    # Masa suci = b (10 hari)
    masa_suci = b
    
    # Darah kedua 2 hari:
    # Karena kurang dari 15 hari dan masih dalam pola, ini haid
    if kd2 < 15:
        haid_kedua = kd2
        istihadloh_kedua = 0
    else:
        haid_kedua = ah  # maksimal sesuai kebiasaan
        istihadloh_kedua = kd2 - ah
    
    result = {
        "kasus": "Mu'tadah Ghoiru Mumayyizah",
        "input": input_string,
        "darah_pertama": {
            "total_hari": kd1,
            "haid": haid_pertama,
            "istihadloh": istihadloh_pertama,
            "keterangan": f"{haid_pertama} haid, {istihadloh_pertama} istihadloh"
        },
        "masa_suci": masa_suci,
        "darah_kedua": {
            "total_hari": kd2,
            "haid": haid_kedua,
            "istihadloh": istihadloh_kedua,
            "keterangan": f"{haid_kedua} haid" if istihadloh_kedua == 0 else f"{haid_kedua} haid, {istihadloh_kedua} istihadloh"
        },
        "summary": f"kd {kd1} ({haid_pertama} haid, {istihadloh_pertama} istihadloh) b {masa_suci} suci kd {kd2} haid"
    }
    
    return result["summary"]

def run_test(input_data, expected_output):
    """
    Run a single test case.
    Returns True if test passes, False otherwise.
    """
    result = process_input(input_data)
    passed = result == expected_output
    
    print(f"\n{'='*60}")
    print(f"INPUT:    {input_data}")
    print(f"EXPECTED: {expected_output}")
    print(f"GOT:      {result}")
    print(f"STATUS:   {'✓ PASS' if passed else '✗ FAIL'}")
    print(f"{'='*60}\n")
    
    return passed

def main():
    print("Logic Test System - Fiqih Haid")
    print("Kasus: Mu'tadah Ghoiru Mumayyizah")
    print("Format: Input -> Expected Output -> Fix if needed\n")
    
    # Test case dari user
    test_cases = [
        {
            "input": "ah 9 as 20 kd 21 b 10 kd 2",
            "expected": "kd 21 (9 haid, 12 istihadloh) b 10 suci kd 2 haid",
            "description": "Kasus Mu'tadah Ghoiru Mumayyizah - Test 1"
        }
    ]
    
    passed_count = 0
    for i, test in enumerate(test_cases, 1):
        print(f"\nTest Case {i}: {test['description']}")
        if run_test(test["input"], test["expected"]):
            passed_count += 1
    
    print(f"\n{'='*60}")
    print(f"Hasil: {passed_count}/{len(test_cases)} test passed")
    print(f"{'='*60}")
    
    if passed_count < len(test_cases):
        print("\n⚠️  Ada test yang gagal. Silakan berikan jawaban yang benar,")
        print("   lalu saya akan memperbaiki logicnya.")

if __name__ == "__main__":
    main()
