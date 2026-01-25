

# **The Alegra API Flow for Creating a Transaction with Dynamic Prerequisites**

### **1\. Executive Summary**

This report provides a comprehensive, three-stage API flow for creating a sales invoice in the Alegra accounting software when prerequisite records, specifically contacts and items, may not yet exist in the system. The documented workflow outlines a resilient "upsert" pattern, specifying the exact API endpoints, required data models, and error handling for each step. The primary finding is that a robust integration must first attempt to locate an existing record before proceeding with its creation. This report synthesizes information from official documentation, third-party integration platforms, and developer discussions to present a practical blueprint for a production-ready solution. It also highlights critical business and technical considerations, such as the nuances of electronic invoicing and localized data models, that are essential for successful implementation. The architectural pattern documented herein ensures data integrity by preventing the creation of duplicate records while guaranteeing a smooth and automated transaction lifecycle.

### **2\. Foundational Concepts of the Alegra API**

#### **2.1. Platform Disambiguation**

A preliminary clarification is necessary to ensure the correct API is being referenced. While a variety of products and services bear names similar to "Alegra," this report focuses exclusively on the API for the cloud-based accounting and invoicing software developed by Soluciones Alegra S.A.S. This is a critical distinction, as other similarly named entities, such as "Allegra Homes" 1 or "Alegra Group AG" 2, operate in entirely different domains, such as real estate and IT consulting. Most notably, a separate "Allegra REST API 2.0.1" 3 exists for managing "workitems" and "workspaces," which are elements of a project management system. A developer may encounter documentation for this alternative API, but its functions, such as

/v1/items for work items and /v1/people for users, are distinct from the accounting API's focus on invoices, contacts, and inventory.5 The Alegra API central to this analysis is the one designed to manage financial processes for small and medium enterprises.5

#### **2.2. API Authentication and Endpoints**

The Alegra API is a RESTful service accessible via a standard base URL for both production and sandbox environments. The production base URL for version 1 of the API is https://api.alegra.com/api/v1.7 For development and testing purposes, a completely independent sandbox environment is available at

https://sandbox-api.alegra.com/e-provider/col/v1.10 The use of this sandbox is a non-negotiable best practice for any new integration, as it allows for unrestricted testing without the risk of corrupting production data or issuing non-compliant documents.10

Authentication for the API is handled using a Basic HTTP authentication scheme, which requires a user\_email and an access\_token.11 The

access\_token can be generated from the Alegra API configuration page within the application's interface.11 Integrations with third-party platforms such as Pipedream manage this authentication securely by storing these credentials, which underscores their importance for API access.11

### **3\. The Prerequisite Workflow: Contact and Category Management**

The first steps in a robust workflow are to ensure the existence of the supplier (proveedor) and the correct expense category. Your proposed workflow begins with a receipt, which contains the fundamental data for a supplier bill (factura de proveedor). This section will detail the "check-and-create" pattern for both suppliers and expense categories, which must exist before a bill can be created.

#### **3.1. Country-Specific Requirements for the Dominican Republic**

Alegra is a platform leader in the Dominican Republic and is aligned with the local tax authority, the DGII (Dirección General de Impuestos Internos).17 For a successful integration, it is critical to use the specific identifiers required by the DGII, such as the RNC (Registro Nacional de Contribuyentes) or cédula for contacts.17 The RNC is a unique identification number used for taxpayers.19 Additionally, all fiscal documents, known as electronic fiscal receipts (

e-CF) 18, require a Numbered Fiscal Voucher (

NCF).19 Alegra can automatically generate required fiscal reports for the DGII, such as 606, 607, and IT-1.17

#### **3.2. The "Check-and-Create" Pattern for Suppliers**

Alegra classifies a contact as a client, provider, both, or neither.21 The recommended approach for a receipt-based workflow is to first search for the supplier by their name or identification number (RNC/cédula).11

The Alegra API provides a direct endpoint to retrieve a contact by its unique identifier (id) using a GET request to https://api.alegra.com/api/v1/contacts/{id}.9 While some documentation may not explicitly detail search functionality by name, major integration platforms confirm that it exists, allowing you to search for a contact before attempting to create a duplicate.11  
If the search returns a 404 Not Found response or an empty list, it signals that the supplier record does not exist.13 This is the explicit trigger to create a new contact record.

#### **3.3. Creating a New Supplier (POST /contacts)**

If a supplier record is not found, the application must create one before the bill can be generated. This is achieved by sending a POST request to the endpoint https://api.alegra.com/api/v1/contacts.24 The request payload must be a JSON object containing the supplier's details. The

identification field, which corresponds to the RNC or cédula, is an example of a required field in certain country-specific actions.15

The type field in the payload must be set to \["provider"\] to correctly classify the contact. For a contact that is both a client and a provider, you would use \["client", "provider"\].21

The following table synthesizes a general data model for creating a new contact, with a focus on suppliers:

| Field Name | Data Type | Required | Description / Business Context |
| :---- | :---- | :---- | :---- |
| name | string | Yes | The full name of the contact. Mandatory for identification. |
| identification | string | Optional | A unique identification number (e.g., tax ID, national ID), such as the RNC in the Dominican Republic. |
| email | string | Optional | The primary email address for communication. |
| type | array of strings | Yes | Must be \["provider"\], \["client"\], or \["client", "provider"\]. |
| address | object | Varies by country | A nested object for the contact's address. Includes fields like address and city. |
| phonePrimary | string | Optional | The main phone number. |
| ignoreRepeated | boolean | Optional | A flag to override duplicate identification checks. |
| statementAttached | boolean | Optional | A flag to include an account statement link in communications. |

Upon a successful creation, the API will return a response containing a unique id for the new contact. This id is a crucial piece of data that must be captured and stored, as it will be used as the foreign key in the final bill creation request.

#### **3.4. The "Check-and-Create" Pattern for Expense Categories**

In a receipt-based workflow, a product may not correspond to an item in inventory but to a general expense. In this case, you must ensure the existence of the correct accounting category before creating the transaction. Alegra allows the creation of expense categories, which are a type of contable (accounting) account.20

The endpoint to create an accounting category is POST /api/v1/item-categories for item categories, and POST /api/{version}/categories for accounting categories.26 A

GET request to /api/{version}/categories can be used to check for an existing category before creating a new one.28

#### **3.5. Creating a New Expense Category (POST /categories)**

If a category does not exist, you must create one. The payload for this request is a JSON object. Key required fields include name and idParent (the ID of the parent account), and you must specify the type as expense.26

The following table details the data model for creating a new expense category:

| Field Name | Data Type | Required | Description |
| :---- | :---- | :---- | :---- |
| idParent | integer | Yes | The unique identifier of the parent accounting account. |
| name | string | Yes | The name of the accounting category. |
| code | string | Optional | A custom code for the account. |
| description | string | Optional | A description for the category. |
| type | string enum | Yes | The type of account. Must be expense for a gasto category. |

A successful creation will return the unique id for the new category, which is required for the final bill creation request.

### **4\. The Transactional Workflow: Supplier Bill Creation**

This is the final and most crucial step, where the captured IDs of the supplier and the expense category are used to create the final transaction.

#### **4.1. The Supplier Bill Creation Endpoint (POST /bills)**

The endpoint for creating a new supplier bill is POST /api/v1/bills.29 The request payload for this endpoint must be a JSON object that links the bill to the supplier and the expense category. This is the API-driven equivalent of the manual process of creating a supplier bill by entering the supplier's name, invoice number, date, and products or accounting accounts.30 A separate

PUT endpoint is also available for editing a supplier bill by its ID.32

The payload would include a nested object for the supplier with the id captured from the previous step, as well as an items array. Within the items array, you can either reference a product item by its ID or, for an expense, an accounting category ID.30 The payload can also include other critical details such as the invoice number and date from the receipt.30

#### **4.2. Attaching the Receipt**

As part of your workflow, you can attach the receipt image to the newly created supplier bill. The Alegra API provides a specific endpoint for this purpose: POST /api/v1/bills/{id}/attachment.33 This endpoint allows you to associate the digital receipt with the financial transaction.

### **5\. The Complete End-to-End Workflow for the Dominican Republic**

The following is a step-by-step blueprint of the entire process, adapted to your use case.

1. **Initial Data:** The workflow is initiated by your app processing a receipt. The data extracted includes the supplier's name, RNC/cédula, the expense category name, and the bill's details (e.g., invoice number, amount, date).  
2. **Supplier Existence Check:** Execute a GET request to the contacts endpoint, using a query parameter to search by the supplier's name or RNC.  
   * **Success:** If a matching contact is found, capture its unique id.  
   * **Failure:** If no results are found, proceed to Step 3\.  
3. **Supplier Creation:** If the supplier does not exist, execute a POST request to the contacts endpoint with a JSON payload containing the supplier's details, including the identification (RNC/cédula) and setting the type field to \["provider"\]. Capture the id of the newly created supplier.  
4. **Expense Category Existence Check:** Execute a GET request to the categories endpoint, searching for the name of the expense category identified on the receipt.  
   * **Success:** If the category is found, capture its unique id.  
   * **Failure:** If the category is not found, proceed to Step 5\.  
5. **Expense Category Creation:** If the category does not exist, execute a POST request to the categories endpoint with a JSON payload containing the category name and idParent, and setting the type to expense. Capture the id of the newly created category.  
6. **Supplier Bill Creation:** With the supplier id and the expense category id captured, execute a final POST request to the bills endpoint (/v1/bills). The payload must include the supplier id and the expense category id within the items array, along with the other details from the receipt.  
7. **Attach Receipt:** Once the bill has been created and you have its id, send a POST request to the attachments endpoint (/v1/bills/{id}/attachment), using a multipart form data payload containing the receipt image.  
8. **Payment Handling:** As you requested, the payment recording will be handled as a separate flow. The documentation confirms that payments are handled separately.34

### **6\. Best Practices and Error Handling**

A production-ready integration requires robust error handling beyond simple 404 checks. A 400 Bad Request signals that the request payload is malformed or missing a required field, requiring the developer to review the payload against the API's documentation.14 A

403 Forbidden indicates a permissions issue, which could be due to an incorrect API key or insufficient user privileges.14 For APIs with high transaction volumes, it is crucial to handle

429 Too Many Requests responses by implementing a retry mechanism with exponential backoff to avoid hitting rate limits.14

Finally, for business-critical applications, the use of Alegra's webhooks is highly recommended.15 Instead of repeatedly polling the API for status updates, webhooks allow Alegra to send a

POST request to a predefined URL in the developer's application whenever a key event, such as a new invoice creation or an electronic invoice status change, occurs.16 This provides a more efficient and reactive architecture for keeping systems synchronized.

#### **Works cited**

1. Allegra Homes \- Luxury Custom Homes in Sarasota, accessed September 7, 2025, [https://allegra-homes.com/](https://allegra-homes.com/)  
2. Alegra Group (Remote): Exciting \*\*REMOTE\*\* Opportunity for OpenShift Developers\! \- JOIN, accessed September 7, 2025, [https://join.com/companies/stone-sourcing/14785991-exciting-remote-opportunity-for-openshift-developers](https://join.com/companies/stone-sourcing/14785991-exciting-remote-opportunity-for-openshift-developers)  
3. Allegra REST API, accessed September 7, 2025, [https://docs.alltena.com/docs/allegra/latest-dist/rest-api/2.0/index.html](https://docs.alltena.com/docs/allegra/latest-dist/rest-api/2.0/index.html)  
4. Welcome to Allegra's REST API\! — Allegra 7.1 documentation, accessed September 7, 2025, [https://track.ambo.ro/track/help/WebAPI/index.html](https://track.ambo.ro/track/help/WebAPI/index.html)  
5. Features Alegra, the Invoicing and accounting software for SMEs, accessed September 7, 2025, [https://almost-www.alegra.com/en/features/](https://almost-www.alegra.com/en/features/)  
6. Electronic billing. | Soluciones Alegra S.A.S.| Colombian B2B Marketplace, accessed September 7, 2025, [https://b2bmarketplace.procolombia.co/en/software-it-services/financial-software/electronic-billing.-24098](https://b2bmarketplace.procolombia.co/en/software-it-services/financial-software/electronic-billing.-24098)  
7. Eliminar ítem \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/delete\_items](https://developer.alegra.com/reference/delete_items)  
8. Consultar un ítem \- Alegra API Documentation, accessed September 7, 2025, [https://developer.alegra.com/reference/get\_items-id](https://developer.alegra.com/reference/get_items-id)  
9. Obtener detalle de un contacto \- Alegra API Documentation, accessed September 7, 2025, [https://developer.alegra.com/reference/contactsdetails-1](https://developer.alegra.com/reference/contactsdetails-1)  
10. Entornos \- API Alegra Proveedor electrónico, accessed September 7, 2025, [https://e-provider-docs.alegra.com/docs/entornos](https://e-provider-docs.alegra.com/docs/entornos)  
11. Alegra API Integrations \- Pipedream, accessed September 7, 2025, [https://pipedream.com/apps/alegra](https://pipedream.com/apps/alegra)  
12. Alegra API \- Conecta tu cuenta con otras aplicaciones, accessed September 7, 2025, [https://ayuda.alegra.com/es/alegra-api-conecta-tu-cuenta-con-otras-aplicaciones](https://ayuda.alegra.com/es/alegra-api-conecta-tu-cuenta-con-otras-aplicaciones)  
13. Troubleshooting 404 Not Found Error \- Tyk.io, accessed September 7, 2025, [https://support.tyk.io/hc/en-gb/articles/8493840744732-Troubleshooting-404-Not-Found-Error](https://support.tyk.io/hc/en-gb/articles/8493840744732-Troubleshooting-404-Not-Found-Error)  
14. Understanding API Error Codes: 10 Status Errors When Building APIs For The First Time And How To Fix Them \- Moesif, accessed September 7, 2025, [https://www.moesif.com/blog/technical/monitoring/Understanding-API-Error-Codes-10-Status-Errors-When-Building-APIs-For-The-First-Time-And-How-To-Fix-Them/](https://www.moesif.com/blog/technical/monitoring/Understanding-API-Error-Codes-10-Status-Errors-When-Building-APIs-For-The-First-Time-And-How-To-Fix-Them/)  
15. Alegra Webhooks by Zapier Integration \- Quick Connect, accessed September 7, 2025, [https://zapier.com/apps/alegra/integrations/webhook](https://zapier.com/apps/alegra/integrations/webhook)  
16. Webhooks \- API Alegra Proveedor electrónico, accessed September 7, 2025, [https://e-provider-docs.alegra.com/docs/webhooks](https://e-provider-docs.alegra.com/docs/webhooks)  
17. Sistema Contable para MiPymes | Alegra | Líder en Dominicana, accessed September 7, 2025, [https://www.alegra.com/rdominicana/](https://www.alegra.com/rdominicana/)  
18. Sistema de Facturación Electrónica para República Dominicana \- Alegra, accessed September 7, 2025, [https://www.alegra.com/rdominicana/factura-electronica/](https://www.alegra.com/rdominicana/factura-electronica/)  
19. 11 Tipos de Comprobantes Fiscales en República Dominicana, accessed September 7, 2025, [https://blog.alegra.com/republica-dominicana/tipos-de-comprobantes-fiscales-en-republica-dominicana/](https://blog.alegra.com/republica-dominicana/tipos-de-comprobantes-fiscales-en-republica-dominicana/)  
20. Alegra Live \- Estrategias Prácticas para automatizar tus reportes fiscales en R. Dominicana, accessed September 7, 2025, [https://www.youtube.com/watch?v=XQNsJ7nJi8E](https://www.youtube.com/watch?v=XQNsJ7nJi8E)  
21. Descripción general \- Alegra API Documentation, accessed September 7, 2025, [https://developer.alegra.com/reference/descripci%C3%B3n-general](https://developer.alegra.com/reference/descripci%C3%B3n-general)  
22. Contactos \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/docs/contactos](https://developer.alegra.com/docs/contactos)  
23. Billing Charges \- API Reference \- Payload Docs, accessed September 7, 2025, [https://docs.payload.com/apis/object-reference/billing-charges/](https://docs.payload.com/apis/object-reference/billing-charges/)  
24. Crear un contacto \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/post\_contacts](https://developer.alegra.com/reference/post_contacts)  
25. okchaty/alegra: A Python library for Alegra's API \- GitHub, accessed September 7, 2025, [https://github.com/okchaty/alegra](https://github.com/okchaty/alegra)  
26. Crear cuenta contables \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/categoriescreate](https://developer.alegra.com/reference/categoriescreate)  
27. Crear categoría de item \- Alegra API Documentation, accessed September 7, 2025, [https://developer.alegra.com/reference/post\_item-categories](https://developer.alegra.com/reference/post_item-categories)  
28. Lista de comprobantes contables \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/comprobantes-contables-1](https://developer.alegra.com/reference/comprobantes-contables-1)  
29. Crear una factura de proveedor \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/post\_bills](https://developer.alegra.com/reference/post_bills)  
30. Registro de facturas de compra a proveedores en la App Móvil ..., accessed September 7, 2025, [https://www.youtube.com/watch?v=88BINZEIIFY](https://www.youtube.com/watch?v=88BINZEIIFY)  
31. ¿Cómo crear una Factura de Compra a Proveedores?, accessed September 7, 2025, [https://ayuda.alegra.com/int/c%C3%B3mo-crear-una-factura-de-compra-a-proveedores](https://ayuda.alegra.com/int/c%C3%B3mo-crear-una-factura-de-compra-a-proveedores)  
32. Editar una factura de proveedor \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/put\_bills-id](https://developer.alegra.com/reference/put_bills-id)  
33. Adjuntar un archivo \- alegra api, accessed September 7, 2025, [https://developer.alegra.com/reference/post\_bills-id-attachment](https://developer.alegra.com/reference/post_bills-id-attachment)  
34. Consultar pagos \- Alegra API Documentation, accessed September 7, 2025, [https://developer.alegra.com/reference/get\_payments](https://developer.alegra.com/reference/get_payments)