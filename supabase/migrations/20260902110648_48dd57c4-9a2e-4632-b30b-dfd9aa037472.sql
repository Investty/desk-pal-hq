
-- employee-documents bucket policies (files stored under <user_id>/<filename>)
CREATE POLICY "Users can view own documents files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins can view all document files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can upload document files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update document files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete document files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'employee-documents' AND public.has_role(auth.uid(), 'admin'));

-- avatars bucket policies (files stored under <user_id>/<filename>)
CREATE POLICY "Authenticated can view avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
