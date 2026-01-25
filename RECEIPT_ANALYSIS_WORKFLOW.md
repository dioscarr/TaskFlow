# Dominican Receipt Analysis Workflow

## Overview
When analyzing Dominican receipts, the AI will now automatically verify business information with DGII before extracting bill data.

## Automatic Workflow

### Step 1: Extract RNC
The AI identifies and extracts the RNC (Registro Nacional de Contribuyentes) from the receipt image.

### Step 2: Verify with DGII ✨ **NEW**
The AI automatically calls `verify_dgii_rnc` with the extracted RNC to:
- Get the official business name from DGII
- Verify the business status (Active/Inactive)
- Obtain the complete legal business information

### Step 3: Extract Bill Data
The AI calls `extract_alegra_bill` with:
- The **verified** business name from DGII (not the name on the receipt)
- All extracted receipt data (date, amount, NCF, items, etc.)
- Verification status and official name

## Benefits

✅ **Accuracy**: Uses official DGII data instead of potentially misspelled receipt text
✅ **Validation**: Ensures the business is registered and active
✅ **Compliance**: Maintains accurate records with verified business information
✅ **Automation**: No manual lookup required - happens automatically

## Example Flow

**User**: "Analyze this receipt"

**AI Response**:
1. 🔍 Extracting RNC from receipt... Found: 131000225563
2. 🔎 Verifying business with DGII...
   - Business Name: ITBIS SRL
   - Status: ACTIVO
   - Type: PERSONA JURIDICA
3. 📄 Extracting bill data with verified information...
   - Provider: ITBIS SRL (verified)
   - Amount: RD$ 231.59
   - NCF: E310002255623
   - Date: 2024-01-10
4. ✅ Bill extracted and saved to database

## Technical Details

### Updated AI Instructions
```
RECEIPT ANALYSIS WORKFLOW (CRITICAL):
- When analyzing a Dominican receipt, you MUST follow this sequence:
  a) First, extract the RNC from the receipt
  b) Immediately call 'verify_dgii_rnc' with the extracted RNC to validate the business
  c) Then call 'extract_alegra_bill' with the verified business name and all receipt data
- This ensures accurate business information from DGII's official database
```

### Tool Descriptions
- `verify_dgii_rnc`: "MUST be called when analyzing receipts to verify the business before extracting bill data."
- `extract_alegra_bill`: Includes `isVerified` and `verifiedName` fields to store DGII validation results

## Database Schema
The `AlegraBill` model stores:
- `providerName`: Name from receipt (may be abbreviated)
- `verifiedName`: Official name from DGII
- `isVerified`: Boolean indicating DGII verification status
- `identification`: The RNC number

## User Experience
Users don't need to do anything different - just ask the AI to analyze a receipt and the verification happens automatically in the background!
