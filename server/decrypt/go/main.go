package main

// Conformance test: go run . vectors.json

import (
	"crypto/ecdh"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func main() {
	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	var data struct {
		PrivateKeyPem string `json:"privateKeyPem"`
		Vectors       []struct {
			Name, Envelope, Context string
			Expect                  *string
		} `json:"vectors"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		panic(err)
	}
	priv, kid, err := LoadKey(data.PrivateKeyPem)
	if err != nil {
		panic(err)
	}
	keys := map[string]*ecdh.PrivateKey{kid: priv}
	var bad []string
	for _, v := range data.Vectors {
		pt, err := OpenEnvelope(v.Envelope, keys, v.Context)
		ok := (err == nil && v.Expect != nil && hex.EncodeToString(pt) == *v.Expect) || (err != nil && v.Expect == nil)
		if !ok {
			bad = append(bad, v.Name)
		}
	}
	if len(bad) > 0 {
		fmt.Println("FAIL " + strings.Join(bad, ","))
		return
	}
	fmt.Println("PASS")
}
