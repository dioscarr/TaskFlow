# Hybrid HTML Rendering with ASP.NET Core and Go

This document outlines the steps to set up a hybrid architecture where ASP.NET Core handles the main server-side logic and Go processes the HTML rendering. This approach leverages the performance benefits of Go for HTML processing while maintaining the existing ASP.NET Core infrastructure.

## Step-by-Step Guide

### Step 1: Set Up the Go Service for HTML Processing

1. **Create a new Go project**:
   - Initialize a new Go module.
   - Install necessary packages like `gin-gonic/gin` for the web framework.

```go name=main.go
package main

import (
    "github.com/gin-gonic/gin"
    "net/http"
    "html/template"
    "bytes"
)

func main() {
    r := gin.Default()
    r.POST("/render", func(c *gin.Context) {
        var requestBody struct {
            Template string
            Data     map[string]interface{}
        }

        if err := c.BindJSON(&requestBody); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }

        tmpl, err := template.New("template").Parse(requestBody.Template)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        var renderedHTML bytes.Buffer
        if err := tmpl.Execute(&renderedHTML, requestBody.Data); err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        c.String(http.StatusOK, renderedHTML.String())
    })

    r.Run(":8081")
}
```

### Step 2: Configure ASP.NET Core to Forward Requests to the Go Service

1. **Create a service in ASP.NET Core to communicate with the Go service**:
   - Use `HttpClient` to send requests to the Go service and retrieve the rendered HTML.

```csharp name=Services/GoRenderingService.cs
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

public class GoRenderingService
{
    private readonly HttpClient _httpClient;

    public GoRenderingService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<string> RenderTemplateAsync(string template, object data)
    {
        var requestBody = new
        {
            Template = template,
            Data = data
        };

        var jsonContent = JsonConvert.SerializeObject(requestBody);
        var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

        var response = await _httpClient.PostAsync("http://localhost:8081/render", content);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadAsStringAsync();
    }
}
```

2. **Register the `GoRenderingService` in `Startup.cs`**:
   - Add the service to the dependency injection container.

```csharp name=Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllersWithViews();
    services.AddHttpClient<GoRenderingService>();
}
```

3. **Use the `GoRenderingService` in a controller to render HTML**:
   - Forward requests to the Go service and return the rendered HTML to the client.

```csharp name=Controllers/HomeController.cs
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

public class HomeController : Controller
{
    private readonly GoRenderingService _goRenderingService;

    public HomeController(GoRenderingService goRenderingService)
    {
        _goRenderingService = goRenderingService;
    }

    public async Task<IActionResult> Index()
    {
        var model = new
        {
            Title = "Home Page",
            Heading = "Welcome",
            Content = "This is an example using Go for HTML processing."
        };

        string template = @"
        <!DOCTYPE html>
        <html lang=""en"">
        <head>
            <meta charset=""UTF-8"">
            <title>{{ .Title }}</title>
        </head>
        <body>
            <h1>{{ .Heading }}</h1>
            <p>{{ .Content }}</p>
        </body>
        </html>";

        string renderedHTML = await _goRenderingService.RenderTemplateAsync(template, model);
        return Content(renderedHTML, "text/html");
    }
}
```

### Additional Considerations
- **Error Handling**: Ensure proper error handling in both the Go service and the ASP.NET Core application.
- **Security**: Secure the communication between the ASP.NET Core application and the Go service, such as using HTTPS.
- **Performance**: Optimize both the Go service and the ASP.NET Core application for performance, especially if handling a large number of requests.

By following these steps, you can set up a hybrid architecture where ASP.NET Core handles the main server logic and Go processes the HTML rendering. This approach minimizes errors and ensures a smooth implementation.