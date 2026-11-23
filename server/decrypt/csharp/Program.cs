// Conformance test: dotnet run -- vectors.json
using System.Text.Json;

var doc = JsonDocument.Parse(File.ReadAllText(args[0])).RootElement;
var (key, kid) = Pfe.LoadKey(doc.GetProperty("privateKeyPem").GetString()!);
var keys = new Dictionary<string, System.Security.Cryptography.ECDiffieHellman> { [kid] = key };
var bad = new List<string>();
foreach (var v in doc.GetProperty("vectors").EnumerateArray())
{
    string? got;
    try { got = Convert.ToHexString(Pfe.Open(v.GetProperty("envelope").GetString()!, keys, v.GetProperty("context").GetString()!)).ToLowerInvariant(); }
    catch (Pfe.PfeException) { got = null; }
    var expect = v.GetProperty("expect").ValueKind == JsonValueKind.Null ? null : v.GetProperty("expect").GetString();
    if (got != expect) bad.Add(v.GetProperty("name").GetString()!);
}
Console.WriteLine(bad.Count > 0 ? "FAIL " + string.Join(",", bad) : "PASS");
