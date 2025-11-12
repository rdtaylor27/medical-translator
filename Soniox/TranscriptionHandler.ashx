<%@ WebHandler Language="C#" Class="TranscriptionHandler" %>

using System;
using System.Web;
using System.Net;
using System.IO;
using System.Text;

public class TranscriptionHandler : IHttpHandler
{
    private static readonly string SONIOX_API_KEY = System.Configuration.ConfigurationManager.AppSettings["Sionix_ApiKey"];
    private static readonly string SONIOX_API_URL = "https://api.soniox.com/v1/auth/temporary-api-key";
    
    public bool IsReusable 
    { 
        get { return false; } 
    }

    public void ProcessRequest(HttpContext context)
    {
        // Enable CORS for cross-origin requests
        context.Response.Headers.Add("Access-Control-Allow-Origin", "*");
        context.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS");
        context.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
        
        // Handle preflight OPTIONS request
        if (context.Request.HttpMethod == "OPTIONS")
        {
            context.Response.StatusCode = 200;
            return;
        }
        
        if (context.Request.HttpMethod != "GET")
        {
            context.Response.StatusCode = 405;
            context.Response.Write("Method not allowed. Use GET.");
            return;
        }

        try
        {
            // Check if we have the API key
            if (string.IsNullOrEmpty(SONIOX_API_KEY))
            {
                context.Response.StatusCode = 500;
                context.Response.ContentType = "application/json";
                context.Response.Write("{\"error\": \"Soniox API key not configured\"}");
                return;
            }
            
            // Enable TLS 1.2 for Soniox API compatibility
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            
            // Call Soniox API to get temporary API key
            using (var client = new WebClient())
            {
                client.Headers.Add("Authorization", "Bearer " + SONIOX_API_KEY);
                client.Headers.Add("Content-Type", "application/json");
                
                // Create request body for temporary API key
                string requestBody = @"{
                    ""usage_type"": ""transcribe_websocket"",
                    ""expires_in_seconds"": 60
                }";
                
                try
                {
                    string response = client.UploadString(SONIOX_API_URL, "POST", requestBody);
                    
                    context.Response.ContentType = "application/json";
                    context.Response.Write(response);
                }
                catch (WebException ex)
                {
                    context.Response.StatusCode = 500;
                    context.Response.ContentType = "application/json";
                    
                    string errorMessage = ex.Message;
                    if (ex.Response != null)
                    {
                        using (var stream = ex.Response.GetResponseStream())
                        using (var reader = new StreamReader(stream))
                        {
                            string responseText = reader.ReadToEnd();
                            if (!string.IsNullOrEmpty(responseText))
                            {
                                context.Response.Write(responseText);
                                return;
                            }
                        }
                    }
                    
                    context.Response.Write("{\"error\": \"Soniox API error: " + errorMessage + "\"}");
                }
            }
        }
        catch (Exception ex)
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            // Create simple JSON error response
            string errorMessage = ex.Message.Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "");
            context.Response.Write("{\"error\": \"Server error: " + errorMessage + "\"}");
            
            // Also log the error for debugging
            System.Diagnostics.Trace.WriteLine("TranscriptionHandler error: " + ex.ToString());
        }
    }
} 