<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml" lang="en">
      <head>
        <title>Fixer — XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
            background-color: #15161a;
            color: #e5e3dc;
            margin: 0;
            padding: 40px 20px;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
            background: #1c1d22;
            border: 1px solid #2d2f36;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          h1 {
            color: #dc9138;
            font-size: 24px;
            margin: 0 0 10px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          p {
            color: #9b9a95;
            font-size: 14px;
            line-height: 1.6;
            margin: 0 0 20px;
          }
          a {
            color: #f0aa52;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background-color: #23252b;
            color: #dc9138;
            text-align: left;
            padding: 12px 14px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 2px solid #2d2f36;
          }
          td {
            padding: 12px 14px;
            border-bottom: 1px solid #26282f;
            font-size: 14px;
          }
          tr:hover td {
            background-color: #202227;
          }
          .badge {
            background: rgba(220, 145, 56, 0.15);
            color: #f0aa52;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #2d2f36;
            font-size: 12px;
            color: #7d7c77;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>◐ Fixer XML Sitemap</h1>
          <p>
            This XML sitemap is generated for Google, Bing, Apple, and other search engine crawlers. Developed by <a href="https://www.linkedin.com/in/jojin-john/" target="_blank">JOJIN JOHN</a>.
          </p>
          <table>
            <thead>
              <tr>
                <th>URL / Location</th>
                <th>Priority</th>
                <th>Change Frequency</th>
                <th>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <tr>
                  <td>
                    <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
                  </td>
                  <td><span class="badge"><xsl:value-of select="sitemap:priority"/></span></td>
                  <td><xsl:value-of select="sitemap:changefreq"/></td>
                  <td><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
          <div class="footer">
            <span>Fixer — Client-side Image Processing Studio</span>
            <span><a href="https://jojin1709.github.io/fixer/">Open App ↗</a></span>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
