BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Reorganiza products.id pra numeração sequencial (0001, 0002...),
-- ordenado por categoria e depois nome.
--
-- Passo 1: garante que order_items.product_id acompanha a mudança de
-- id automaticamente (ON UPDATE CASCADE) — sem isso, o UPDATE abaixo
-- falharia por violação de foreign key assim que um produto já tivesse
-- pedido no histórico.
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.order_items'::regclass
    AND confrelid = 'public.products'::regclass
    AND contype = 'f';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', v_conname);
  END IF;

  ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_product_fkey
    FOREIGN KEY (product_id, store_id) REFERENCES public.products(id, store_id)
    ON UPDATE CASCADE;
END $$;

-- Passo 2: renomeia cada produto pro novo ID sequencial.
-- Migration gerada a partir da lista de produtos enviada pelo usuário.
-- Ordem: category, name (já veio ordenado assim da query).

UPDATE public.products SET id = '0001' WHERE id = '023037' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ANTARCTICA 600ML
UPDATE public.products SET id = '0002' WHERE id = '024262' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAIXA AMSTEL 600ML
UPDATE public.products SET id = '0003' WHERE id = '028642' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAIXA BRAHMA 600ML
UPDATE public.products SET id = '0004' WHERE id = '020998' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAIXA HEINEKEN 600ML
UPDATE public.products SET id = '0005' WHERE id = '025309' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAIXA KAISER 600ML
UPDATE public.products SET id = '0006' WHERE id = '024635' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAIXA SKOL 600ML
UPDATE public.products SET id = '0007' WHERE id = '021494' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PACK AMSTEL LATA 473ml
UPDATE public.products SET id = '0008' WHERE id = '027003' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PACK BRAHMA LATA 473ML
UPDATE public.products SET id = '0009' WHERE id = '023908' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PACK HEINEKEN LATA 473ML
UPDATE public.products SET id = '0010' WHERE id = '028729' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PACK KAISER LATA 473ML
UPDATE public.products SET id = '0011' WHERE id = '000468' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AMSTEL 600 ML
UPDATE public.products SET id = '0012' WHERE id = '000464' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AMSTEL LATÃO
UPDATE public.products SET id = '0013' WHERE id = '025282' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AMSTEL ULTRA 269ML
UPDATE public.products SET id = '0014' WHERE id = '023665' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AMSTEL ULTRA LATA 473ML
UPDATE public.products SET id = '0015' WHERE id = '000374' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AMSTEL ULTRA LONG NECK
UPDATE public.products SET id = '0016' WHERE id = '000656' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ANTARCTICA 600ML
UPDATE public.products SET id = '0017' WHERE id = '010152' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ANTARCTICA PILSEN LATÃO
UPDATE public.products SET id = '0018' WHERE id = '000488' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ANTARCTICA SUB ZERO LATA 473ML
UPDATE public.products SET id = '0019' WHERE id = '000489' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ANTARCTICA SUB ZERO LITRO 1L
UPDATE public.products SET id = '0020' WHERE id = '010011' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BADEN 600ML
UPDATE public.products SET id = '0021' WHERE id = '8000704' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BG (Baixa Gastronomia)
UPDATE public.products SET id = '0022' WHERE id = '000461' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BOHEMIA 600ML
UPDATE public.products SET id = '0023' WHERE id = '000463' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BOHEMIA LATÃO
UPDATE public.products SET id = '0024' WHERE id = '000432' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BOHEMIA LITRINHO
UPDATE public.products SET id = '0025' WHERE id = '000462' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BOHEMIA LITRO 1L
UPDATE public.products SET id = '0026' WHERE id = '8000663' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA 600ML
UPDATE public.products SET id = '0027' WHERE id = '000529' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA DUPLOMALTE LATÃO
UPDATE public.products SET id = '0028' WHERE id = '9999' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA LATA MALZBIER
UPDATE public.products SET id = '0029' WHERE id = '000440' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA LATÃO
UPDATE public.products SET id = '0030' WHERE id = '000431' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA LITRINHO
UPDATE public.products SET id = '0031' WHERE id = '000434' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA LITRO 1L
UPDATE public.products SET id = '0032' WHERE id = '000619' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRAHMA ZERO LATA 350ML
UPDATE public.products SET id = '0033' WHERE id = '8000832' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRUTAL LATA
UPDATE public.products SET id = '0034' WHERE id = '8000796' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BRUTAL LONG NECK
UPDATE public.products SET id = '0035' WHERE id = '000598' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER 600ML
UPDATE public.products SET id = '0036' WHERE id = '000638' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER LATÃO
UPDATE public.products SET id = '0037' WHERE id = '8000618' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER LITRINHO
UPDATE public.products SET id = '0038' WHERE id = '010060' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER LITRO 1L
UPDATE public.products SET id = '0039' WHERE id = '000601' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER LONG NECK
UPDATE public.products SET id = '0040' WHERE id = '010128' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER ZERO LATA 350ML
UPDATE public.products SET id = '0041' WHERE id = '8000836' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BUDWEISER ZERO LATA 473ML
UPDATE public.products SET id = '0042' WHERE id = '000584' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CARACU LATA
UPDATE public.products SET id = '0043' WHERE id = '8000769' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CORONA LATA ZERO 350ML
UPDATE public.products SET id = '0044' WHERE id = '0002222' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CORONA LATÃO
UPDATE public.products SET id = '0045' WHERE id = '000597' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CORONA LONG NECK
UPDATE public.products SET id = '0046' WHERE id = '8000700' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CORONA ZERO LONG NECK
UPDATE public.products SET id = '0047' WHERE id = '8000788' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- EISENBAHN IPA LATA 350ML
UPDATE public.products SET id = '0048' WHERE id = '000615' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- EISENBAHN IPA LONG NECK
UPDATE public.products SET id = '0049' WHERE id = '027737' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FLYING FISH 473ML
UPDATE public.products SET id = '0050' WHERE id = '000476' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HEINEKEN 600ML
UPDATE public.products SET id = '0051' WHERE id = '020302' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HEINEKEN BARRIL 5L
UPDATE public.products SET id = '0052' WHERE id = '000477' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HEINEKEN LATÃO
UPDATE public.products SET id = '0053' WHERE id = '000478' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HEINEKEN LONG NECK
UPDATE public.products SET id = '0054' WHERE id = '000480' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HEINEKEN ZERO LATA 350ML
UPDATE public.products SET id = '0055' WHERE id = '000479' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HEINEKEN ZERO LONG NECK
UPDATE public.products SET id = '0056' WHERE id = '8000825' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- IMPERIO PURO MALTE 473ML
UPDATE public.products SET id = '0057' WHERE id = '8000826' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- IMPERIO ULTRA LONG NECK 275ML
UPDATE public.products SET id = '0058' WHERE id = '8000686' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ITAIPAVA LATÃO 473ML
UPDATE public.products SET id = '0059' WHERE id = '8000774' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ITAIPAVA MEGA LATÃO
UPDATE public.products SET id = '0060' WHERE id = '000546' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ITAIPAVA ZERO LATA 350ML
UPDATE public.products SET id = '0061' WHERE id = '000481' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- KAISER 600ML
UPDATE public.products SET id = '0062' WHERE id = '000482' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- KAISER LATÃO
UPDATE public.products SET id = '0063' WHERE id = '024051' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MICHELOB ULTRA LONG NECK
UPDATE public.products SET id = '0064' WHERE id = '000475' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ORIGINAL 600ML
UPDATE public.products SET id = '0065' WHERE id = '010059' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ORIGINAL LATÃO
UPDATE public.products SET id = '0066' WHERE id = '010106' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ORIGINAL LITRINHO
UPDATE public.products SET id = '0067' WHERE id = '8000612' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ORIGINAL LITRO 1L
UPDATE public.products SET id = '0068' WHERE id = '000526' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PETRA 600ML
UPDATE public.products SET id = '0069' WHERE id = '000525' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PETRA LATÃO
UPDATE public.products SET id = '0070' WHERE id = '010201' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PROIBIDA LATÃO
UPDATE public.products SET id = '0071' WHERE id = '000557' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SERRA MALTE 600ML
UPDATE public.products SET id = '0072' WHERE id = '7891149200405000436' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL 600ML
UPDATE public.products SET id = '0073' WHERE id = '000343' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL BEATS GT LONG NECK
UPDATE public.products SET id = '0074' WHERE id = '000438' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL BEATS LATA
UPDATE public.products SET id = '0075' WHERE id = '8000811' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL BEATS LATA VERMELHA
UPDATE public.products SET id = '0076' WHERE id = '8000680' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL BEATS LATÃO
UPDATE public.products SET id = '0077' WHERE id = '010054' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL BEATS LONG NECK AZUL
UPDATE public.products SET id = '0078' WHERE id = '8000673' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL BEATS TROPICAL LATA
UPDATE public.products SET id = '0079' WHERE id = '000439' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL GT LATA
UPDATE public.products SET id = '0080' WHERE id = '000437' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL LATÃO
UPDATE public.products SET id = '0081' WHERE id = '7891149103300' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL LITRINHO
UPDATE public.products SET id = '0082' WHERE id = '000435' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SKOL LITRO 1L
UPDATE public.products SET id = '0083' WHERE id = '000600' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPATEN 600ML
UPDATE public.products SET id = '0084' WHERE id = '010170' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPATEN LATÃO
UPDATE public.products SET id = '0085' WHERE id = '000535' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPATEN LONG NECK
UPDATE public.products SET id = '0086' WHERE id = '000599' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- STELLA 600ML
UPDATE public.products SET id = '0087' WHERE id = '118000592' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- STELLA ARTOIS PURE GOLD LONG NECK
UPDATE public.products SET id = '0088' WHERE id = '000486' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- STELLA LATÃO
UPDATE public.products SET id = '0089' WHERE id = '8000710' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- STELLA LATÃO GOLD
UPDATE public.products SET id = '0090' WHERE id = '000487' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- STELLA LONG NECK
UPDATE public.products SET id = '0091' WHERE id = '010145' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- XEQUE MATE 362 ML
UPDATE public.products SET id = '0092' WHERE id = '000575' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BALLANTINES
UPDATE public.products SET id = '0093' WHERE id = '8000703' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BEM CASADO 1L
UPDATE public.products SET id = '0094' WHERE id = '010177' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BLACK JOKER ORIGINAL
UPDATE public.products SET id = '0095' WHERE id = '8000632' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CABARE FIRE 1 L
UPDATE public.products SET id = '0096' WHERE id = '000561' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CACHAÃA 51 965ML
UPDATE public.products SET id = '0097' WHERE id = '010122' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CACHAÃA JEREMIAS
UPDATE public.products SET id = '0098' WHERE id = '8000711' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAMPARI 900ML
UPDATE public.products SET id = '0099' WHERE id = '8000759' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CANELINHA DA ROCHA 900ML
UPDATE public.products SET id = '0100' WHERE id = '000569' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CONHAQUE DREHER
UPDATE public.products SET id = '0101' WHERE id = '000556' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CONHAQUE PRESIDENTE
UPDATE public.products SET id = '0102' WHERE id = '000566' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CONHAQUE SÃO JOÃO DA BARRA
UPDATE public.products SET id = '0103' WHERE id = '000578' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GIN GORDONS
UPDATE public.products SET id = '0104' WHERE id = '010108' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GIN INTENCION
UPDATE public.products SET id = '0105' WHERE id = '000579' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GIN TANQUERAY 1L
UPDATE public.products SET id = '0106' WHERE id = '8000795' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ICE 51 LIMÃO
UPDATE public.products SET id = '0107' WHERE id = '010112' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ICE CABARE LIMÃO
UPDATE public.products SET id = '0108' WHERE id = '000547' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ICE SMIRNOFF LONG NECK
UPDATE public.products SET id = '0109' WHERE id = '000592' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ICE SYN
UPDATE public.products SET id = '0110' WHERE id = '8000833' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- OLD CESAR CACHAÃA 88
UPDATE public.products SET id = '0111' WHERE id = '000405' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ORLOFF
UPDATE public.products SET id = '0112' WHERE id = '000565' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PARATUDO
UPDATE public.products SET id = '0113' WHERE id = '010110' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PASSPORT SCOTCH
UPDATE public.products SET id = '0114' WHERE id = '8000690' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PINGA DA ROÃA
UPDATE public.products SET id = '0115' WHERE id = '000576' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- RED LABEL 1L
UPDATE public.products SET id = '0116' WHERE id = '8000798' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- RUM MONTILLA
UPDATE public.products SET id = '0117' WHERE id = '010085' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SALINAS 600ML
UPDATE public.products SET id = '0118' WHERE id = '000563' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SELVAGEM
UPDATE public.products SET id = '0119' WHERE id = '8000638' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VODKA KRISKOF 900ml
UPDATE public.products SET id = '0120' WHERE id = '010071' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VODKA KRISKOF BANANINHA 900ml
UPDATE public.products SET id = '0121' WHERE id = '8000637' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VODKA KRISKOF BLUE 900ml
UPDATE public.products SET id = '0122' WHERE id = '8000636' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VODKA KRISKOF RED 900ml
UPDATE public.products SET id = '0123' WHERE id = '000581' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VODKA SMIRNOFF 1L
UPDATE public.products SET id = '0124' WHERE id = '010211' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- WHISKY WHITE HORSE
UPDATE public.products SET id = '0125' WHERE id = '000577' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- XAROPE DE LIMÃO PORTO RICO
UPDATE public.products SET id = '0126' WHERE id = '026991' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BALY MELANCIA 473ML
UPDATE public.products SET id = '0127' WHERE id = '029920' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BALY TRAD 473ML
UPDATE public.products SET id = '0128' WHERE id = '020397' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BALY TROPICAL 473ML
UPDATE public.products SET id = '0129' WHERE id = '000506' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- JACK POWER TRADICIONAL 2L
UPDATE public.products SET id = '0130' WHERE id = '020046' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MONSTER ABSOLUTELY ZERO LATA 473ML
UPDATE public.products SET id = '0131' WHERE id = '000591' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MONSTER ENERGY LATA 473ML
UPDATE public.products SET id = '0132' WHERE id = '020555' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MONSTER MANGO LOCO LATA 473ML
UPDATE public.products SET id = '0133' WHERE id = '027611' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MONSTER ULTRA WHITE 473ML
UPDATE public.products SET id = '0134' WHERE id = '000483' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- RED BULL ENERGY LATA 250ML
UPDATE public.products SET id = '0135' WHERE id = '021983' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- RED BULL TROPICAL 250ML
UPDATE public.products SET id = '0136' WHERE id = '027630' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- RED BULL ZERO LATA 250ML
UPDATE public.products SET id = '0137' WHERE id = '000513' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA 20L
UPDATE public.products SET id = '0138' WHERE id = '010067' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA 500ML FARDO
UPDATE public.products SET id = '0139' WHERE id = '000596' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA 5L
UPDATE public.products SET id = '0140' WHERE id = '8000681' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA COM GAS NESTLE 510ml
UPDATE public.products SET id = '0141' WHERE id = '010220' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA COM GAS Pack
UPDATE public.products SET id = '0142' WHERE id = '8000834' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ÃGUA CRYSTAL SEM GAS 1,5L
UPDATE public.products SET id = '0143' WHERE id = '000363' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA DE COCO QUADRADO 1L
UPDATE public.products SET id = '0144' WHERE id = '8000813' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ÃGUA DE COCO TIAL 200ML
UPDATE public.products SET id = '0145' WHERE id = '010006' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA IGARAPE COM GAS 1.5L
UPDATE public.products SET id = '0146' WHERE id = '00407' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA iGARAPÃ COM GÃS 500ml
UPDATE public.products SET id = '0147' WHERE id = '8000707' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- AGUA SÃO LORENÃO 1.5 COM GAS
UPDATE public.products SET id = '0148' WHERE id = '8000600' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ÃGUA SÃO LORENÃO 510 ML COM GÃS
UPDATE public.products SET id = '0149' WHERE id = '8000810' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ÃGUA TROPICAL FARDO 500ML
UPDATE public.products SET id = '0150' WHERE id = '8000737' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- BALA ICE KISS EXTRA FORTE 500G
UPDATE public.products SET id = '0151' WHERE id = '024514' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CARVÃO 10KG
UPDATE public.products SET id = '0152' WHERE id = '028406' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CARVÃO 3KG
UPDATE public.products SET id = '0153' WHERE id = '024101' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GATORADE BERRY BLUE
UPDATE public.products SET id = '0154' WHERE id = '000498' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GATORADE LIMÃO
UPDATE public.products SET id = '0155' WHERE id = '021651' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GATORADE MORANGO E MARACUJA
UPDATE public.products SET id = '0156' WHERE id = '023841' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GATORADE UVA
UPDATE public.products SET id = '0157' WHERE id = '8000765' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GELINHO SABORIZADO
UPDATE public.products SET id = '0158' WHERE id = '000511' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GELO 10KG
UPDATE public.products SET id = '0159' WHERE id = '000512' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GELO CUBO 4KG
UPDATE public.products SET id = '0160' WHERE id = '026921' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- H2O LIMÃO 500ML
UPDATE public.products SET id = '0161' WHERE id = '000644' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- H2OH LIMÃO 1,5L
UPDATE public.products SET id = '0162' WHERE id = '023241' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- H2OH LIMONETO 1.5L
UPDATE public.products SET id = '0163' WHERE id = '000495' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- H2OH LIMONETO 500ML
UPDATE public.products SET id = '0164' WHERE id = '000397' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- HALLS EXTRA FORTE
UPDATE public.products SET id = '0165' WHERE id = '000595' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SAN MARINO
UPDATE public.products SET id = '0166' WHERE id = '010232' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TORCIDA SABOR QUEIJO 60G
UPDATE public.products SET id = '0167' WHERE id = '000447' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA 2L
UPDATE public.products SET id = '0168' WHERE id = '000602' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA 3L
UPDATE public.products SET id = '0169' WHERE id = '000496' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA 600ML
UPDATE public.products SET id = '0170' WHERE id = '000594' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA KS
UPDATE public.products SET id = '0171' WHERE id = '000448' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA LATA 350ML
UPDATE public.products SET id = '0172' WHERE id = '000450' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA RETORNAVEL 2L
UPDATE public.products SET id = '0173' WHERE id = '000451' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ULTRA 1L
UPDATE public.products SET id = '0174' WHERE id = '8000742' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO 1L
UPDATE public.products SET id = '0175' WHERE id = '8000653' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO 200ML
UPDATE public.products SET id = '0176' WHERE id = '000631' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO 2L
UPDATE public.products SET id = '0177' WHERE id = '010066' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO 600ML
UPDATE public.products SET id = '0178' WHERE id = '8000693' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO LATA 220ML
UPDATE public.products SET id = '0179' WHERE id = '000617' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO LATA 350ML
UPDATE public.products SET id = '0180' WHERE id = '000449' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- COCA COLA ZERO RETORNAVEL 2L
UPDATE public.products SET id = '0181' WHERE id = '026796' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- DEL VALLE UVA ZERO 1L
UPDATE public.products SET id = '0182' WHERE id = '000559' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA LARANJA 2L
UPDATE public.products SET id = '0183' WHERE id = '010100' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA LARANJA LATA 350ML
UPDATE public.products SET id = '0184' WHERE id = '000452' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA LARANJA RETORNAVEL 2L
UPDATE public.products SET id = '0185' WHERE id = '8000664' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA MARACUJÃ LATA
UPDATE public.products SET id = '0186' WHERE id = '000558' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA UVA 2L
UPDATE public.products SET id = '0187' WHERE id = '8000816' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA UVA LATA 350ML
UPDATE public.products SET id = '0188' WHERE id = '010009' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA UVA RETORNAVEL
UPDATE public.products SET id = '0189' WHERE id = '8000631' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- FANTA ZERO 2L
UPDATE public.products SET id = '0190' WHERE id = '000606' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARANÃ 200ML
UPDATE public.products SET id = '0191' WHERE id = '010021' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARANA ANTARCTICA 1L
UPDATE public.products SET id = '0192' WHERE id = '000442' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARANA ANTARCTICA 2L
UPDATE public.products SET id = '0193' WHERE id = '000624' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARANA ANTARCTICA 3L
UPDATE public.products SET id = '0194' WHERE id = '000582' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARANA ANTARCTICA LATA 350ML
UPDATE public.products SET id = '0195' WHERE id = '8000588' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARANA ANTARTICA ZERO 2L
UPDATE public.products SET id = '0196' WHERE id = '000490' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARAPAN
UPDATE public.products SET id = '0197' WHERE id = '8000662' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARAPAN 220ML
UPDATE public.products SET id = '0198' WHERE id = '8000705' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- GUARAVITA
UPDATE public.products SET id = '0199' WHERE id = '8000754' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- KUAT 2L
UPDATE public.products SET id = '0200' WHERE id = '8000776' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MATE COURO 200ML
UPDATE public.products SET id = '0201' WHERE id = '000493' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MATE COURO 2L
UPDATE public.products SET id = '0202' WHERE id = '000492' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MATE COURO ZERO 2L
UPDATE public.products SET id = '0203' WHERE id = '000634' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PEPSI 200ML
UPDATE public.products SET id = '0204' WHERE id = '000458' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PEPSI 2L
UPDATE public.products SET id = '0205' WHERE id = '000459' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PEPSI TWIST 2L
UPDATE public.products SET id = '0206' WHERE id = '010187' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- PEPSI ZERO BLACK 2L
UPDATE public.products SET id = '0207' WHERE id = '8000603' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SCHWEPPES 1,5L
UPDATE public.products SET id = '0208' WHERE id = '000460' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SODA 2L
UPDATE public.products SET id = '0209' WHERE id = '000649' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPRITE 2L
UPDATE public.products SET id = '0210' WHERE id = '8000750' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPRITE LATA 350ML
UPDATE public.products SET id = '0211' WHERE id = '8000657' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPRITE LATA ZERO
UPDATE public.products SET id = '0212' WHERE id = '000429' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SPRITE ZERO 2L
UPDATE public.products SET id = '0213' WHERE id = '023047' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO DEL VALLE MANGA 1L
UPDATE public.products SET id = '0214' WHERE id = '021733' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO DEL VALLE MARACUJA 1L
UPDATE public.products SET id = '0215' WHERE id = '010062' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO DEL VALLE UVA 1L
UPDATE public.products SET id = '0216' WHERE id = '010207' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO KAPO MORANGO
UPDATE public.products SET id = '0217' WHERE id = '010208' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO KAPO UVA
UPDATE public.products SET id = '0218' WHERE id = '029322' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL ABACAXI 1L
UPDATE public.products SET id = '0219' WHERE id = '027864' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL CAJU 1L
UPDATE public.products SET id = '0220' WHERE id = '027497' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL GOIABA 1L
UPDATE public.products SET id = '0221' WHERE id = '023931' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL LARANJA 1L
UPDATE public.products SET id = '0222' WHERE id = '000413' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL MANGA 1L
UPDATE public.products SET id = '0223' WHERE id = '8000733' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL PESSÃGO 1L
UPDATE public.products SET id = '0224' WHERE id = '000509' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL UVA 1L
UPDATE public.products SET id = '0225' WHERE id = '000593' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUCO TIAL UVA 330ML
UPDATE public.products SET id = '0226' WHERE id = '000424' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUKITA 200ML
UPDATE public.products SET id = '0227' WHERE id = '000444' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUKITA LARANJA 2L
UPDATE public.products SET id = '0228' WHERE id = '000491' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- SUKITA UVA 2L
UPDATE public.products SET id = '0229' WHERE id = '010053' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TAMPICO 2L
UPDATE public.products SET id = '0230' WHERE id = '010079' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TONICA 1L
UPDATE public.products SET id = '0231' WHERE id = '000522' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TONICA FYS LATA
UPDATE public.products SET id = '0232' WHERE id = '000521' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TONICA LATA
UPDATE public.products SET id = '0233' WHERE id = '000523' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TONICA SCHWEPPES
UPDATE public.products SET id = '0234' WHERE id = '8000658' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TONICA ZERO 1L
UPDATE public.products SET id = '0235' WHERE id = '000520' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- TONICA ZERO LATA 350ML
UPDATE public.products SET id = '0236' WHERE id = '010001' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CAMPO LARGO SUAVE
UPDATE public.products SET id = '0237' WHERE id = '000543' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CANTINA DA SERRA
UPDATE public.products SET id = '0238' WHERE id = '8000739' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CHAMPANHE
UPDATE public.products SET id = '0239' WHERE id = '010127' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CHOP DE VINHO PINK MOON
UPDATE public.products SET id = '0240' WHERE id = '000356' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CHOPP HALLER 350ML
UPDATE public.products SET id = '0241' WHERE id = '000572' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- CORTEZANO
UPDATE public.products SET id = '0242' WHERE id = '8000818' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- ESPUMANTE CAMPO LARGO MOSCATEL
UPDATE public.products SET id = '0243' WHERE id = '000564' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- LEÃO DO NORTE
UPDATE public.products SET id = '0244' WHERE id = '000567' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- MARTINI BIANCO
UPDATE public.products SET id = '0245' WHERE id = '000538' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VINHO CHAPINHA TINTO SUAVE
UPDATE public.products SET id = '0246' WHERE id = '000539' AND store_id = '935e3078-fae5-4801-b301-b1828d0df6da'; -- VINHO PERGOLA 1L

COMMIT;
