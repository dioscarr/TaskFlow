# CRM Dashboard UI Design Plan

## Dashboard Sections

1.  **Header:** Logo, user profile, date/time.
2.  **Overview:** Key metrics (sales, customers, deals) displayed as cards.
3.  **Charts:**
    *   Sales Performance Chart: Line chart showing sales trends over time.
    *   Customer Growth Chart: Bar chart showing new customer acquisition.
    *   Lead Conversion Chart: Pie chart showing lead conversion rates.
4.  **Tables:**
    *   Recent Activities Table: List of recent activities (e.g., calls, emails, meetings).
    *   Top Deals Table: List of top deals with relevant information (e.g., deal name, value, stage).

## Components

*   Header Component
*   Metric Card Component
*   Sales Chart Component
*   Customer Growth Chart Component
*   Lead Conversion Chart Component
*   Recent Activities Table Component
*   Top Deals Table Component

## Data

*   Sales Data (time series)
*   Customer Data (new customers per period)
*   Lead Data (conversion rates)
*   Activity Data (recent activities with timestamps)
*   Deal Data (deal name, value, stage)

## Folder Structure

```
components/
  Header.tsx
  MetricCard.tsx
  SalesChart.tsx
  CustomerGrowthChart.tsx
  LeadConversionChart.tsx
  RecentActivitiesTable.tsx
  TopDealsTable.tsx
index.tsx // Main Dashboard
```

## Next Steps

1.  Create the folder structure.
2.  Implement the components with dummy data.
3.  Integrate with real data sources.
4.  Add styling and responsiveness.
