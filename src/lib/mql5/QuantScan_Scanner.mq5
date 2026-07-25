//+------------------------------------------------------------------+
//|                                           QuantScan_Scanner.mq5 |
//|                                     Copyright 2024, QuantScan   |
//|                                      https://quantscan.ai/      |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, QuantScan"
#property link      "https://quantscan.ai/"
#property version   "1.00"
#property description "Expert Advisor to send chart screenshots to QuantScan AI for analysis"

//--- input parameters
input string InpApiUrl = "https://ais-pre-2qjjtufvjfmelag7qr6xs4-6521254605.europe-west3.run.app/api/mt-scanner";

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   // Add a button to the chart
   ObjectCreate(0, "BtnQuantScan", OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, "BtnQuantScan", OBJPROP_XDISTANCE, 20);
   ObjectSetInteger(0, "BtnQuantScan", OBJPROP_YDISTANCE, 20);
   ObjectSetInteger(0, "BtnQuantScan", OBJPROP_XSIZE, 120);
   ObjectSetInteger(0, "BtnQuantScan", OBJPROP_YSIZE, 40);
   ObjectSetString(0, "BtnQuantScan", OBJPROP_TEXT, "Scan IA");
   ObjectSetInteger(0, "BtnQuantScan", OBJPROP_BGCOLOR, clrBlue);
   ObjectSetInteger(0, "BtnQuantScan", OBJPROP_COLOR, clrWhite);
   
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Base64 Encoding Helper                                           |
//+------------------------------------------------------------------+
string Base64Encode(uchar &data[])
  {
   uchar key[];
   uchar result[];
   if(CryptEncode(CRYPT_BASE64, data, key, result))
     {
      return CharArrayToString(result);
     }
   return "";
  }

//+------------------------------------------------------------------+
//| ChartEvent function                                              |
//+------------------------------------------------------------------+
void OnChartEvent(const int id,
                  const long &lparam,
                  const double &dparam,
                  const string &sparam)
  {
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == "BtnQuantScan")
     {
      Print("Capturing chart for QuantScan AI...");
      
      // Reset button state
      ObjectSetInteger(0, "BtnQuantScan", OBJPROP_STATE, false);
      ChartRedraw(0);
      
      // Capture screenshot
      string fileName = "quantscan_temp.png";
      if(ChartScreenShot(0, fileName, 800, 600, ALIGN_RIGHT))
        {
         // Read binary file
         int fileHandle = FileOpen(fileName, FILE_READ|FILE_BIN);
         if(fileHandle != INVALID_HANDLE)
           {
            int fileSize = (int)FileSize(fileHandle);
            uchar fileData[];
            FileReadArray(fileHandle, fileData, 0, fileSize);
            FileClose(fileHandle);
            
            // Encode to Base64
            string base64Str = Base64Encode(fileData);
            
            if(base64Str != "")
              {
               // Collect Metadata
               string sym = Symbol();
               int tf = Period();
               double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
               double bid = SymbolInfoDouble(sym, SYMBOL_BID);
               
               // Build JSON Payload
               string json = "{\"imageBase64\":\"" + base64Str + "\",\"metadata\":{\"symbol\":\"" + sym + "\",\"timeframe\":" + IntegerToString(tf) + ",\"ask\":" + DoubleToString(ask, 5) + ",\"bid\":" + DoubleToString(bid, 5) + "}}";
               
               // Prepare WebRequest
               char postData[];
               char resultData[];
               string resultHeaders;
               StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
               // Remove trailing null character from array
               ArrayResize(postData, ArraySize(postData) - 1);
               
               string headers = "Content-Type: application/json\r\n";
               
               Print("Sending request to QuantScan AI API...");
               int res = WebRequest("POST", InpApiUrl, headers, 5000, postData, resultData, resultHeaders);
               
               if(res == 200)
                 {
                  string responseStr = CharArrayToString(resultData);
                  Print("QuantScan AI Response: ", responseStr);
                  MessageBox("Análise recebida com sucesso! Verifique a aba Experts (Diário) para os resultados JSON.", "QuantScan AI", MB_ICONINFORMATION);
                 }
               else
                 {
                  Print("Error in WebRequest: ", res, " (Error Code: ", GetLastError(), ")");
                  if(GetLastError() == 4014)
                     MessageBox("Erro 4014: Você precisa permitir WebRequests para " + InpApiUrl + " em Ferramentas -> Opções -> Expert Advisors.", "Erro QuantScan AI", MB_ICONERROR);
                 }
              }
           }
         else
           {
            Print("Failed to open screenshot file.");
           }
        }
     }
  }

